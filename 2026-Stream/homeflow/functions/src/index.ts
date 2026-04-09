/**
 * StreamSync Cloud Functions
 *
 * - throneIngestDaily:   Scheduled daily at 12 AM PT, syncs Throne data to Firestore
 * - syncThroneNow:       HTTP trigger for manual/dev sync (requires x-admin-token header)
 * - syncThroneUserMap:   Firestore trigger — keeps throneUserMap in sync when a user's
 *                        throneUserId field is set or changed by the study coordinator
 *
 * Required env vars (functions/.env):
 *   THRONE_API_KEY, THRONE_BASE_URL, ADMIN_TOKEN
 * One of:
 *   THRONE_STUDY_ID
 *   THRONE_STUDY_IDS (comma-separated list)
 * Optional:
 *   THRONE_TIMEZONE (defaults to America/Los_Angeles)
 */

import {setGlobalOptions} from "firebase-functions/v2";
import {onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import * as logger from "firebase-functions/logger";
import {runThroneIngestion, ThroneConfig} from "./throneIngestion";
export {
  smartAuthorizeUrl,
  completeSmartConnection,
  syncSmartClinicalData,
} from "./smartOnFhir";

admin.initializeApp();

setGlobalOptions({maxInstances: 10});

// ─── Config ──────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function getBearerToken(req: any): string | null {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

async function requireResearcherUid(req: any): Promise<string> {
  const bearer = getBearerToken(req);
  if (!bearer) throw new Error("Missing Firebase bearer token");
  const decoded = await admin.auth().verifyIdToken(bearer);
  const researcherDoc = await admin.firestore().collection("Researchers").doc(decoded.uid).get();
  if (!researcherDoc.exists) {
    throw new Error("Authenticated user is not approved for researcher access");
  }
  return decoded.uid;
}

function normalizeEnrollmentEmail(value: string): string {
  return value.trim().toLowerCase();
}

function buildThroneUserIdFromEmail(email: string): string {
  return normalizeEnrollmentEmail(email);
}

function setCorsHeaders(req: any, res: any): boolean {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "*";
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
}

function getConfiguredStudyIds(): string[] {
  const ids = [
    ...(process.env.THRONE_STUDY_IDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ];
  const singleStudyId = process.env.THRONE_STUDY_ID?.trim();
  if (singleStudyId) ids.push(singleStudyId);
  const uniqueIds = Array.from(new Set(ids));
  if (!uniqueIds.length) {
    throw new Error("Missing required env var: THRONE_STUDY_ID or THRONE_STUDY_IDS");
  }
  return uniqueIds;
}

function getThroneConfigs(requestedStudyId?: string): ThroneConfig[] {
  const baseConfig = {
    apiKey: requireEnv("THRONE_API_KEY"),
    baseUrl: requireEnv("THRONE_BASE_URL"),
    timezone: process.env.THRONE_TIMEZONE || "America/Los_Angeles",
  };
  const studyIds = requestedStudyId ?
    [requestedStudyId] :
    getConfiguredStudyIds();
  return studyIds.map((studyId) => ({
    ...baseConfig,
    studyId,
  }));
}

async function syncedWithinLastHour(studyId: string): Promise<boolean> {
  const db = admin.firestore();
  const syncDoc = await db.collection("throneSync").doc(studyId).get();
  if (!syncDoc.exists) return false;
  const lastRunAt = syncDoc.data()?.lastRunAt as string | undefined;
  if (!lastRunAt) return false;
  const elapsed = Date.now() - new Date(lastRunAt).getTime();
  return elapsed < 60 * 60 * 1000;
}

async function runConfiguredThroneIngestion(opts?: {
  fullSync?: boolean;
  requestedStudyId?: string;
  skipIfRecent?: boolean;
}): Promise<{
  sessionCount: number;
  metricCount: number;
  studyResults: Array<{studyId: string; sessionCount: number; metricCount: number; skipped?: boolean}>;
}> {
  const configs = getThroneConfigs(opts?.requestedStudyId);
  const studyResults: Array<{studyId: string; sessionCount: number; metricCount: number; skipped?: boolean}> = [];
  let sessionCount = 0;
  let metricCount = 0;

  for (const config of configs) {
    if (opts?.skipIfRecent && await syncedWithinLastHour(config.studyId)) {
      logger.info(`Skipping Throne ingestion for ${config.studyId}: synced within the last hour`);
      studyResults.push({studyId: config.studyId, sessionCount: 0, metricCount: 0, skipped: true});
      continue;
    }

    logger.info(`Starting Throne ingestion for study ${config.studyId}`);
    const result = await runThroneIngestion(config, {fullSync: opts?.fullSync});
    sessionCount += result.sessionCount;
    metricCount += result.metricCount;
    studyResults.push({...result, studyId: config.studyId});
  }

  return {sessionCount, metricCount, studyResults};
}

// ─── Scheduled Daily Ingestion ───────────────────────────────────────────────

export const throneIngestDaily = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "America/Los_Angeles",
  },
  async () => {
    logger.info("Starting scheduled Throne ingestion");
    const studyIds = getConfiguredStudyIds();

    try {
      const result = await runConfiguredThroneIngestion();
      logger.info("Throne ingestion complete", result);
    } catch (err) {
      logger.error("Throne ingestion failed", err);

      const db = admin.firestore();
      await Promise.all(studyIds.map((studyId) => db.collection("throneSync").doc(studyId).set({
        lastRunAt: new Date().toISOString(),
        lastStatus: "error",
        lastError: err instanceof Error ? err.message : String(err),
      }, {merge: true})));

      throw err;
    }
  },
);

// ─── Manual HTTP Trigger ─────────────────────────────────────────────────────

// ─── App-Open Sync Trigger ───────────────────────────────────────────────────

/**
 * Fires when the app writes to users/{uid}/sync_requests/latest on first open.
 * Runs ingestion immediately if the study hasn't synced in the last hour,
 * then lets the daily schedule take over afterward.
 */
export const onThroneSyncRequest = onDocumentWritten(
  "users/{uid}/sync_requests/latest",
  async () => {
    logger.info("App-open sync request received — starting ingestion");
    try {
      const result = await runConfiguredThroneIngestion({skipIfRecent: true});
      logger.info("App-open sync complete", result);
    } catch (err) {
      logger.error("App-open sync failed", err);
      throw err;
    }
  },
);

// ─── Manual HTTP Trigger ─────────────────────────────────────────────────────

export const syncThroneNow = onRequest(async (req, res) => {
  if (setCorsHeaders(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const expected = process.env.ADMIN_TOKEN ?? "";
  const token = typeof req.headers["x-admin-token"] === "string" ?
    req.headers["x-admin-token"] :
    "";
  const validToken = expected.length > 0 &&
    token.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  if (!validToken) {
    res.status(401).send("Unauthorized: invalid or missing x-admin-token");
    return;
  }

  logger.info("Manual Throne sync triggered");

  try {
    const fullSync = req.body?.fullSync === true;
    const requestedStudyId = typeof req.body?.studyId === "string" ?
      req.body.studyId.trim() :
      undefined;
    const result = await runConfiguredThroneIngestion({fullSync, requestedStudyId});
    res.status(200).json({status: "ok", fullSync, ...result});
  } catch (err) {
    logger.error("Manual Throne sync failed", err);
    res.status(500).json({
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

export const enrollUdsParticipants = onRequest(async (req, res) => {
  if (setCorsHeaders(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    const researcherUid = await requireResearcherUid(req);
    const rawEmails: unknown[] = Array.isArray(req.body?.emails) ? req.body.emails as unknown[] : [];
    const emails: string[] = Array.from(new Set(
      rawEmails
        .filter((value: unknown): value is string => typeof value === "string")
        .map((value: string) => normalizeEnrollmentEmail(value))
        .filter((value: string) => Boolean(value)),
    ));

    if (!emails.length) {
      res.status(400).json({status: "error", message: "No valid participant emails were provided"});
      return;
    }

    const db = admin.firestore();
    const authClient = admin.auth();
    const created: Array<{email: string; uid: string; throneUserId: string; createdUser: boolean}> = [];
    const skipped: Array<{email: string; reason: string}> = [];

    for (const email of emails) {
      const throneUserId = buildThroneUserIdFromEmail(email);
      const existingPatientByEmail = await db.collection("patients")
        .where("email", "==", email)
        .where("studyKey", "==", "uds")
        .limit(1)
        .get();

      if (!existingPatientByEmail.empty) {
        skipped.push({email, reason: "already enrolled in UDS"});
        continue;
      }

      let userRecord: admin.auth.UserRecord;
      let createdUser = false;
      try {
        userRecord = await authClient.getUserByEmail(email);
      } catch (error: any) {
        if (error?.code !== "auth/user-not-found") {
          throw error;
        }
        userRecord = await authClient.createUser({
          email,
          emailVerified: false,
          password: crypto.randomBytes(24).toString("base64url"),
          displayName: email,
        });
        createdUser = true;
      }

      const userRef = db.collection("users").doc(userRecord.uid);
      const userSnap = await userRef.get();
      const existingThroneUserId = userSnap.exists ?
        String(userSnap.data()?.throneUserId || "").trim() :
        "";

      if (existingThroneUserId && existingThroneUserId !== throneUserId) {
        skipped.push({
          email,
          reason: `existing throneUserId (${existingThroneUserId}) does not match enrollment email`,
        });
        continue;
      }

      await userRef.set({
        email,
        name: userSnap.data()?.name || email,
        displayName: userSnap.data()?.displayName || email,
        throneUserId,
        throneUserIdSetAt: new Date().toISOString(),
        studyKey: "uds",
        studyId: "streamsync-uds",
        status: "active",
        enrolledAt: userSnap.data()?.enrolledAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdAt: userSnap.data()?.createdAt || new Date().toISOString(),
        enrollmentSource: "researcher_dashboard_uds",
      }, {merge: true});

      const patientRef = db.collection("patients").doc();
      await patientRef.set({
        email,
        name: userSnap.data()?.name || email,
        userId: userRecord.uid,
        studyKey: "uds",
        studyId: "streamsync-uds",
        status: "active",
        throneUserId,
        enrolledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: researcherUid,
      }, {merge: true});

      created.push({
        email,
        uid: userRecord.uid,
        throneUserId,
        createdUser,
      });
    }

    res.status(200).json({
      status: "ok",
      created,
      skipped,
    });
  } catch (error) {
    logger.error("UDS participant enrollment failed", error);
    res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
