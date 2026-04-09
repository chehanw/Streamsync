import * as admin from "firebase-admin";
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

interface SmartSystemConfig {
  id: string;
  name: string;
  issuer: string;
  fhirBaseUrl: string;
  clientId: string;
  clientSecret?: string;
}

interface SmartDiscoveryDocument {
  authorization_endpoint: string;
  token_endpoint: string;
}

interface SmartConnectionPrivate {
  providerId: string;
  providerName: string;
  issuer: string;
  fhirBaseUrl: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string | null;
  scope?: string | null;
  expiresAt?: string | null;
  patient?: string | null;
  connectedAt: string;
  lastTokenRefreshAt: string;
}

interface SmartBundle<T> {
  entry?: Array<{resource?: T}>;
  link?: Array<{relation?: string; url?: string}>;
}

interface SyncedClinicalNote {
  id: string;
  title: string;
  date: string | null;
  category: string;
  contentType: string | null;
  rawText: string | null;
  rawDocument: string | null;
  parsedDocType: string;
  parsedText: string | null;
  parsedSections: Array<{title: string; text: string}> | null;
  attachmentEntries: Array<{
    contentType: string | null;
    title: string | null;
    url: string | null;
    size: number | null;
    language: string | null;
    hash: string | null;
  }>;
  selectedAttachment: {
    contentType: string | null;
    title: string | null;
    url: string | null;
  } | null;
  fhirResource: Record<string, any>;
  providerId: string;
  syncedAt: string;
}

interface SmartSyncIssue {
  resourceType: string;
  error: string;
  url: string;
}

interface ParsedNarrativeSection {
  title: string;
  text: string;
}

interface ParsedAttachmentContent {
  rawDocument: string | null;
  rawText: string | null;
  parsedDocType: "cda" | "text" | "pdf" | "unknown";
  parsedText: string | null;
  parsedSections: ParsedNarrativeSection[];
}

interface AttachmentFetchResult {
  contentType: string | null;
  text: string | null;
}

function getBearerToken(req: any): string | null {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

async function requireUid(req: any): Promise<string> {
  const bearer = getBearerToken(req);
  if (!bearer) throw new Error("Missing Firebase bearer token");
  const decoded = await admin.auth().verifyIdToken(bearer);
  return decoded.uid;
}

function getSmartSystems(): SmartSystemConfig[] {
  const raw = process.env.SMART_HEALTH_SYSTEMS_JSON;
  if (!raw) throw new Error("Missing SMART_HEALTH_SYSTEMS_JSON");
  const parsed = JSON.parse(raw) as SmartSystemConfig[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("SMART_HEALTH_SYSTEMS_JSON is empty");
  }
  return parsed;
}

function requireSmartSystem(providerId: string): SmartSystemConfig {
  const system = getSmartSystems().find((entry) => entry.id === providerId);
  if (!system) throw new Error(`Unknown SMART provider: ${providerId}`);
  return system;
}

async function discoverSmartConfiguration(system: SmartSystemConfig): Promise<SmartDiscoveryDocument> {
  const candidates = [
    `${system.fhirBaseUrl.replace(/\/$/, "")}/.well-known/smart-configuration`,
    `${system.issuer.replace(/\/$/, "")}/.well-known/smart-configuration`,
  ];

  for (const url of candidates) {
    const response = await fetch(url);
    if (!response.ok) continue;
    const payload = await response.json() as Partial<SmartDiscoveryDocument>;
    if (payload.authorization_endpoint && payload.token_endpoint) {
      return {
        authorization_endpoint: payload.authorization_endpoint,
        token_endpoint: payload.token_endpoint,
      };
    }
  }

  throw new Error(`Unable to discover SMART configuration for ${system.name}`);
}

function buildAuthorizeUrl(
  system: SmartSystemConfig,
  discovery: SmartDiscoveryDocument,
  redirectUri: string,
  state: string,
  codeChallenge: string,
  scope: string,
): string {
  const url = new URL(discovery.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", system.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("aud", system.fhirBaseUrl);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

function tokenExpiryIso(expiresIn: unknown): string | null {
  if (typeof expiresIn !== "number") return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

async function exchangeCodeForToken(
  system: SmartSystemConfig,
  discovery: SmartDiscoveryDocument,
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<SmartConnectionPrivate> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: system.clientId,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  if (system.clientSecret) {
    body.set("client_secret", system.clientSecret);
  }

  const response = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || "Token exchange failed");
  }

  const now = new Date().toISOString();
  return {
    providerId: system.id,
    providerName: system.name,
    issuer: system.issuer,
    fhirBaseUrl: system.fhirBaseUrl,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    tokenType: payload.token_type ?? null,
    scope: payload.scope ?? null,
    expiresAt: tokenExpiryIso(payload.expires_in),
    patient: payload.patient ?? null,
    connectedAt: now,
    lastTokenRefreshAt: now,
  };
}

async function refreshAccessToken(
  system: SmartSystemConfig,
  discovery: SmartDiscoveryDocument,
  connection: SmartConnectionPrivate,
): Promise<SmartConnectionPrivate> {
  if (!connection.refreshToken) return connection;

  const expiresAt = connection.expiresAt ? new Date(connection.expiresAt).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) return connection;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken,
    client_id: system.clientId,
  });
  if (system.clientSecret) {
    body.set("client_secret", system.clientSecret);
  }

  const response = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || "Token refresh failed");
  }

  return {
    ...connection,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? connection.refreshToken,
    tokenType: payload.token_type ?? connection.tokenType ?? null,
    scope: payload.scope ?? connection.scope ?? null,
    expiresAt: tokenExpiryIso(payload.expires_in),
    patient: payload.patient ?? connection.patient ?? null,
    lastTokenRefreshAt: new Date().toISOString(),
  };
}

async function saveConnection(uid: string, connection: SmartConnectionPrivate): Promise<void> {
  const db = admin.firestore();
  await Promise.all([
    db.doc(`users/${uid}/provider_connections/${connection.providerId}`).set({
      providerId: connection.providerId,
      providerName: connection.providerName,
      issuer: connection.issuer,
      fhirBaseUrl: connection.fhirBaseUrl,
      status: "connected",
      connectedAt: connection.connectedAt,
      expiresAt: connection.expiresAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true}),
    db.doc(`users/${uid}/provider_connections_private/${connection.providerId}`).set({
      ...connection,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true}),
  ]);
}

async function loadConnection(uid: string, providerId: string): Promise<SmartConnectionPrivate> {
  const snap = await admin.firestore()
    .doc(`users/${uid}/provider_connections_private/${providerId}`)
    .get();
  if (!snap.exists) throw new Error("No stored SMART connection found for this provider.");
  return snap.data() as SmartConnectionPrivate;
}

async function fetchJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/fhir+json, application/json",
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.issue?.[0]?.diagnostics || payload.error || `FHIR request failed: ${response.status}`);
  }

  return payload as T;
}

async function fetchBundlePages<T>(firstUrl: string, accessToken: string): Promise<T[]> {
  const resources: T[] = [];
  let nextUrl: string | undefined = firstUrl;

  while (nextUrl) {
    const bundle: SmartBundle<T> = await fetchJson<SmartBundle<T>>(nextUrl, accessToken);
    for (const entry of bundle.entry ?? []) {
      if (entry.resource) resources.push(entry.resource);
    }
    nextUrl = bundle.link?.find((link: {relation?: string; url?: string}) => link.relation === "next")?.url;
  }

  return resources;
}

async function fetchBundlePagesSafe<T>(
  firstUrl: string,
  accessToken: string,
  resourceType: string,
  issues: SmartSyncIssue[],
): Promise<T[]> {
  try {
    return await fetchBundlePages<T>(firstUrl, accessToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({
      resourceType,
      error: message,
      url: firstUrl,
    });
    logger.warn(`SMART ${resourceType} fetch failed`, {
      url: firstUrl,
      error: message,
    });
    return [];
  }
}

async function fetchBinaryText(
  attachmentUrl: string,
  fhirBase: string,
  accessToken: string,
): Promise<AttachmentFetchResult> {
  try {
    const url = attachmentUrl.startsWith("http") ?
      attachmentUrl :
      `${fhirBase}/${attachmentUrl.replace(/^\//, "")}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/fhir+json, application/json, text/plain, */*",
      },
    });
    if (!response.ok) return {contentType: null, text: null};

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("json")) {
      // FHIR Binary resource — base64-encoded data field
      const json = await response.json() as Record<string, any>;
      const binaryType = typeof json.contentType === "string" ? json.contentType : contentType;
      if (typeof json.data === "string") {
        if (binaryType.includes("pdf")) {
          return {contentType: binaryType, text: null};
        }
        return {
          contentType: binaryType,
          text: Buffer.from(json.data, "base64").toString("utf8"),
        };
      }
      return {contentType: binaryType, text: null};
    }
    if (contentType.includes("pdf")) {
      return {contentType, text: null};
    }
    return {contentType, text: await response.text()};
  } catch {
    return {contentType: null, text: null};
  }
}

function looksLikeCda(decoded: string): boolean {
  const head = decoded.slice(0, 2000);
  return head.includes("ClinicalDocument") ||
    head.includes("urn:hl7-org:v3") ||
    (head.trimStart().startsWith("<?xml") && head.includes("<section"));
}

function stripMarkup(markup: string): string {
  return markup
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|preamble|paragraph|item|tr|th|td|li|div|h[1-6])>/gi, "\n")
    .replace(/<li(?:\s[^>]*)?>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseCdaSections(xml: string): ParsedNarrativeSection[] {
  const sections: ParsedNarrativeSection[] = [];
  const sectionPattern = /<section(?:\s[^>]*)?>[\s\S]*?<\/section>/gi;
  const sectionMatches = xml.match(sectionPattern) ?? [];

  for (const block of sectionMatches) {
    const titleMatch = /<title(?:\s[^>]*)?>([^<]*)<\/title>/i.exec(block);
    const title = titleMatch ? stripMarkup(titleMatch[1]).trim() : "";
    const textMatch = /<text(?:\s[^>]*)?>([\s\S]*?)<\/text>/i.exec(block);
    const text = stripMarkup(textMatch ? textMatch[1] : "");
    if (!text || text.length < 3) continue;
    sections.push({
      title: title || "Clinical Note",
      text,
    });
  }

  return sections;
}

function parseAttachmentContent(
  rawDocument: string | null,
  contentType: string | null,
): ParsedAttachmentContent {
  if (!rawDocument) {
    return {
      rawDocument: null,
      rawText: null,
      parsedDocType: contentType?.includes("pdf") ? "pdf" : "unknown",
      parsedText: null,
      parsedSections: [],
    };
  }

  const normalizedType = (contentType || "").toLowerCase();
  if (normalizedType.includes("text/plain")) {
    const plainText = rawDocument.trim();
    return {
      rawDocument,
      rawText: plainText || null,
      parsedDocType: "text",
      parsedText: plainText || null,
      parsedSections: plainText ? [{title: "Clinical Note", text: plainText}] : [],
    };
  }

  if (looksLikeCda(rawDocument)) {
    const sections = parseCdaSections(rawDocument);
    const plainText = sections
      .map((section) => section.title ? `${section.title}\n${section.text}` : section.text)
      .join("\n\n")
      .trim();
    return {
      rawDocument,
      rawText: plainText || null,
      parsedDocType: "cda",
      parsedText: plainText || null,
      parsedSections: sections,
    };
  }

  if (
    normalizedType.includes("text/html") ||
    normalizedType.includes("application/xhtml+xml") ||
    normalizedType.includes("application/xml") ||
    normalizedType.includes("text/xml")
  ) {
    const plainText = stripMarkup(rawDocument);
    return {
      rawDocument,
      rawText: plainText || null,
      parsedDocType: normalizedType.includes("html") ? "text" : "unknown",
      parsedText: plainText || null,
      parsedSections: plainText ? [{title: "Clinical Note", text: plainText}] : [],
    };
  }

  const fallbackText = rawDocument.trim().slice(0, 50_000);
  return {
    rawDocument,
    rawText: fallbackText || null,
    parsedDocType: "unknown",
    parsedText: fallbackText || null,
    parsedSections: fallbackText ? [{title: "Clinical Note", text: fallbackText}] : [],
  };
}

function attachmentPreferenceScore(contentType: string | null | undefined): number {
  const normalized = (contentType || "").toLowerCase();
  if (normalized.includes("text/plain")) return 0;
  if (normalized.includes("text/html") || normalized.includes("application/xhtml+xml")) return 1;
  if (normalized.includes("application/xml") || normalized.includes("text/xml")) return 2;
  if (normalized.includes("pdf")) return 3;
  return 10;
}

function displayNameFromResource(resource: Record<string, any>, fallback: string): string {
  return resource.code?.text ||
    resource.code?.coding?.[0]?.display ||
    resource.medicationCodeableConcept?.text ||
    resource.medicationCodeableConcept?.coding?.[0]?.display ||
    resource.type?.text ||
    resource.type?.coding?.[0]?.display ||
    resource.description ||
    fallback;
}

function calculateAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export const smartAuthorizeUrl = onRequest(async (req, res) => {
  try {
    await requireUid(req);
    const providerId = typeof req.query.providerId === "string" ? req.query.providerId : "";
    const redirectUri = typeof req.query.redirectUri === "string" ? req.query.redirectUri : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const codeChallenge = typeof req.query.codeChallenge === "string" ? req.query.codeChallenge : "";
    const scope = typeof req.query.scope === "string" ? req.query.scope : "";

    if (!providerId || !redirectUri || !state || !codeChallenge || !scope) {
      res.status(400).json({error: "Missing SMART authorize parameters"});
      return;
    }

    const system = requireSmartSystem(providerId);
    const discovery = await discoverSmartConfiguration(system);
    res.status(200).json({
      url: buildAuthorizeUrl(system, discovery, redirectUri, state, codeChallenge, scope),
    });
  } catch (error) {
    logger.error("smartAuthorizeUrl failed", error);
    res.status(500).json({error: error instanceof Error ? error.message : String(error)});
  }
});

export const completeSmartConnection = onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({error: "Method not allowed"});
      return;
    }

    const uid = await requireUid(req);
    const providerId = String(req.body?.providerId || "");
    const code = String(req.body?.code || "");
    const codeVerifier = String(req.body?.codeVerifier || "");
    const redirectUri = String(req.body?.redirectUri || "");
    if (!providerId || !code || !codeVerifier || !redirectUri) {
      res.status(400).json({error: "Missing SMART token exchange parameters"});
      return;
    }

    const system = requireSmartSystem(providerId);
    const discovery = await discoverSmartConfiguration(system);
    const connection = await exchangeCodeForToken(system, discovery, code, codeVerifier, redirectUri);
    await saveConnection(uid, connection);

    res.status(200).json({
      connection: {
        providerId: connection.providerId,
        providerName: connection.providerName,
        issuer: connection.issuer,
        fhirBaseUrl: connection.fhirBaseUrl,
        status: "connected",
        connectedAt: connection.connectedAt,
        expiresAt: connection.expiresAt,
        lastSyncedAt: null,
      },
    });
  } catch (error) {
    logger.error("completeSmartConnection failed", error);
    res.status(500).json({error: error instanceof Error ? error.message : String(error)});
  }
});

export const syncSmartClinicalData = onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({error: "Method not allowed"});
      return;
    }

    const uid = await requireUid(req);
    const providerId = String(req.body?.providerId || "");
    if (!providerId) {
      res.status(400).json({error: "Missing providerId"});
      return;
    }

    const system = requireSmartSystem(providerId);
    const discovery = await discoverSmartConfiguration(system);
    const stored = await loadConnection(uid, providerId);
    const connection = await refreshAccessToken(system, discovery, stored);
    await saveConnection(uid, connection);
    const syncIssues: SmartSyncIssue[] = [];

    // Log the granted scope from the token response
    logger.info("SMART connection scope granted", {
      uid,
      providerId,
      grantedScope: connection.scope,
    });

    const base = system.fhirBaseUrl.replace(/\/$/, "");
    const accessToken = connection.accessToken;
    const patientId = connection.patient;
    let patient: Record<string, any> | null = null;
    let medicationRequests: Record<string, any>[] = [];
    let observations: Record<string, any>[] = [];
    let allergies: Record<string, any>[] = [];
    let conditions: Record<string, any>[] = [];
    let procedures: Record<string, any>[] = [];
    let documentReferences: Record<string, any>[] = [];

    if (!patientId) {
      syncIssues.push({
        resourceType: "Patient",
        error: "SMART token response did not include patient context.",
        url: `${base}/Patient`,
      });
      logger.warn("SMART sync missing patient context", {
        uid,
        providerId,
        grantedScope: connection.scope,
      });
    } else {
      try {
        patient = await fetchJson<Record<string, any>>(
          `${base}/Patient/${encodeURIComponent(patientId)}`,
          accessToken,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        syncIssues.push({
          resourceType: "Patient",
          error: message,
          url: `${base}/Patient/${encodeURIComponent(patientId)}`,
        });
        logger.warn("SMART Patient fetch failed", {
          uid,
          providerId,
          patientId,
          error: message,
        });
      }

      [
        medicationRequests,
        observations,
        allergies,
        conditions,
        procedures,
        documentReferences,
      ] = await Promise.all([
        fetchBundlePagesSafe<Record<string, any>>(
          `${base}/MedicationRequest?patient=${encodeURIComponent(patientId)}&_count=100`,
          accessToken,
          "MedicationRequest",
          syncIssues,
        ),
        fetchBundlePagesSafe<Record<string, any>>(
          `${base}/Observation?patient=${encodeURIComponent(patientId)}&category=laboratory&_count=100`,
          accessToken,
          "Observation",
          syncIssues,
        ),
        fetchBundlePagesSafe<Record<string, any>>(
          `${base}/AllergyIntolerance?patient=${encodeURIComponent(patientId)}&_count=100`,
          accessToken,
          "AllergyIntolerance",
          syncIssues,
        ),
        fetchBundlePagesSafe<Record<string, any>>(
          `${base}/Condition?patient=${encodeURIComponent(patientId)}&_count=100`,
          accessToken,
          "Condition",
          syncIssues,
        ),
        fetchBundlePagesSafe<Record<string, any>>(
          `${base}/Procedure?patient=${encodeURIComponent(patientId)}&_count=100`,
          accessToken,
          "Procedure",
          syncIssues,
        ),
        fetchBundlePagesSafe<Record<string, any>>(
          `${base}/DocumentReference?patient=${encodeURIComponent(patientId)}&_count=100`,
          accessToken,
          "DocumentReference",
          syncIssues,
        ),
      ]);
    }

    const medications = medicationRequests.map((resource) => ({
      displayName: displayNameFromResource(resource, "Medication"),
      fhirResource: resource,
    }));

    const labResults = observations.map((resource) => ({
      displayName: displayNameFromResource(resource, "Lab Result"),
      fhirResource: resource,
    }));

    const mappedConditions = conditions.map((resource) => ({
      displayName: displayNameFromResource(resource, "Condition"),
      fhirResource: resource,
    }));

    const mappedProcedures = procedures.map((resource) => ({
      displayName: displayNameFromResource(resource, "Procedure"),
      fhirResource: resource,
    }));

    logger.info("SMART sync resource counts", {
      uid,
      providerId,
      patientId,
      counts: {
        medications: medications.length,
        labResults: labResults.length,
        allergies: allergies.length,
        conditions: mappedConditions.length,
        procedures: mappedProcedures.length,
        documentReferences: documentReferences.length,
      },
      syncIssues,
      grantedScope: connection.scope,
    });

    // ── Fetch full Binary content for each DocumentReference ──────────────────
    const syncedAt = new Date().toISOString();
    const noteFetchResults = await Promise.allSettled(
      documentReferences.map(async (resource): Promise<SyncedClinicalNote> => {
        const displayName = displayNameFromResource(resource, "Clinical Note");
        const date: string | null =
          (resource.date as string | undefined) ??
          (resource.context?.period?.start as string | undefined) ??
          null;
        const category: string =
          (resource.category?.[0]?.coding?.[0]?.display as string | undefined) ??
          (resource.category?.[0]?.text as string | undefined) ??
          "Clinical Note";

        let rawText: string | null = null;
        let rawDocument: string | null = null;
        let contentType: string | null = null;
        let parsedDocType = "unknown";
        let parsedText: string | null = null;
        let parsedSections: ParsedNarrativeSection[] = [];
        let selectedAttachment: SyncedClinicalNote["selectedAttachment"] = null;

        const attachments = ((resource.content ?? []) as Array<Record<string, any>>)
          .map((item) => item.attachment as Record<string, any> | undefined)
          .filter((attachment): attachment is Record<string, any> => Boolean(attachment));
        const attachmentEntries = attachments.map((attachment) => ({
          contentType: (attachment.contentType as string | undefined) ?? null,
          title: (attachment.title as string | undefined) ?? null,
          url: (attachment.url as string | undefined) ?? null,
          size: typeof attachment.size === "number" ? attachment.size : null,
          language: (attachment.language as string | undefined) ?? null,
          hash: (attachment.hash as string | undefined) ?? null,
        }));

        const sortedAttachments = [...attachments].sort((left, right) =>
          attachmentPreferenceScore(left.contentType as string | undefined) -
          attachmentPreferenceScore(right.contentType as string | undefined)
        );

        for (const attachment of sortedAttachments) {
          const url = attachment.url as string | undefined;
          const declaredContentType = (attachment.contentType as string | undefined) ?? null;
          if (!url) continue;

          const fetched = await fetchBinaryText(url, base, accessToken);
          const effectiveContentType = fetched.contentType || declaredContentType;
          const parsed = parseAttachmentContent(fetched.text, effectiveContentType);

          if (!parsed.rawDocument && !parsed.rawText && effectiveContentType?.includes("pdf")) {
            contentType = effectiveContentType;
            parsedDocType = "pdf";
            selectedAttachment = {
              contentType: effectiveContentType,
              title: (attachment.title as string | undefined) ?? null,
              url,
            };
            break;
          }

          if (parsed.rawText || parsed.rawDocument) {
            contentType = effectiveContentType;
            rawText = parsed.rawText ? parsed.rawText.slice(0, 50_000) : null;
            rawDocument = parsed.rawDocument ? parsed.rawDocument.slice(0, 50_000) : null;
            parsedDocType = parsed.parsedDocType;
            parsedText = parsed.parsedText ? parsed.parsedText.slice(0, 50_000) : null;
            parsedSections = parsed.parsedSections.map((section) => ({
              title: section.title,
              text: section.text.slice(0, 10_000),
            }));
            selectedAttachment = {
              contentType: effectiveContentType,
              title: (attachment.title as string | undefined) ?? null,
              url,
            };
            break;
          }
        }

        return {
          id: resource.id as string,
          title: displayName,
          date,
          category,
          contentType,
          rawText,
          rawDocument,
          parsedDocType,
          parsedText,
          parsedSections: parsedSections.length > 0 ? parsedSections : null,
          attachmentEntries,
          selectedAttachment,
          fhirResource: resource,
          providerId,
          syncedAt,
        };
      }),
    );

    const notes = noteFetchResults
      .filter((r): r is PromiseFulfilledResult<SyncedClinicalNote> => r.status === "fulfilled")
      .map((r) => r.value);
    const totalRecordCount =
      medications.length +
      labResults.length +
      mappedConditions.length +
      mappedProcedures.length +
      notes.length;

    // Only treat explicit auth failures as scope-related sync warnings.
    const scopeRelatedIssues = syncIssues.filter((issue) => {
      const errorLower = issue.error.toLowerCase();
      return errorLower.includes("unauthorized") ||
        errorLower.includes("403");
    });

    const syncWarning =
      totalRecordCount === 0 && scopeRelatedIssues.length > 0 ?
        "Connected successfully, but the health system denied access to the requested " +
        "clinical resources due to insufficient scopes. Update the app's granted SMART scopes, " +
        "then reconnect and sync again." :
        null;

    // ── Persist clinical notes + full clinical data snapshot ──────────────────
    const db = admin.firestore();

    await Promise.all([
      // Write each note to users/{uid}/clinical_notes/{noteId}
      ...notes
        .filter((note) => note.id)
        .map((note) =>
          db.doc(`users/${uid}/clinical_notes/${note.id as string}`).set(note, {merge: true})
        ),

      // Write full clinical records snapshot to users/{uid}/smart_clinical_data/{providerId}
      db.doc(`users/${uid}/smart_clinical_data/${providerId}`).set({
        medications,
        labResults,
        allergies: allergies.map((resource) => ({
          displayName: displayNameFromResource(resource, "Allergy/Intolerance"),
          fhirResource: resource,
        })),
        conditions: mappedConditions,
        procedures: mappedProcedures,
        syncedAt,
      }),

      // Update connection metadata
      db.doc(`users/${uid}/provider_connections/${providerId}`).set({
        lastSyncedAt: syncedAt,
        lastRecordCounts: {
          medications: medications.length,
          labResults: labResults.length,
          allergies: allergies.length,
          conditions: mappedConditions.length,
          procedures: mappedProcedures.length,
          notes: notes.length,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true}),
    ]);

    res.status(200).json({
      connection: {
        providerId: connection.providerId,
        providerName: connection.providerName,
        issuer: connection.issuer,
        fhirBaseUrl: connection.fhirBaseUrl,
        status: "connected",
        connectedAt: connection.connectedAt,
        expiresAt: connection.expiresAt,
        lastSyncedAt: syncedAt,
      },
      demographics: {
        age: calculateAge(patient?.birthDate),
        dateOfBirth: patient?.birthDate ?? null,
        biologicalSex: patient?.gender ? String(patient.gender) : null,
      },
      clinicalRecords: {
        medications,
        labResults,
        allergies: allergies.map((resource) => ({
          displayName: displayNameFromResource(resource, "Allergy/Intolerance"),
          fhirResource: resource,
        })),
        conditions: mappedConditions,
        procedures: mappedProcedures,
        notes: notes.map(({id, title, date, category, contentType, rawText, syncedAt: s}) => ({
          id, title, date, category, contentType,
          textPreview: (rawText as string | null)?.slice(0, 500) ?? null,
          syncedAt: s,
        })),
      },
      syncIssues,
      syncWarning,
      fetchedAt: syncedAt,
    });
  } catch (error) {
    logger.error("syncSmartClinicalData failed", error);
    res.status(500).json({error: error instanceof Error ? error.message : String(error)});
  }
});
