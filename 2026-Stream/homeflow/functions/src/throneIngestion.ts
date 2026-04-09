/**
 * Throne Research API Ingestion Module
 *
 * Fetches uroflow session data from Throne Research API,
 * normalizes sessions + metrics, and writes to Firestore
 * under each participant's user document.
 *
 * Firestore schema (per user):
 *   users/{firebaseUid}/throne_sessions/{sessionId}  — NormalizedSession
 *   users/{firebaseUid}/throne_metrics/{metricId}    — NormalizedMetric
 *   users/{firebaseUid}/throne_sync/state            — per-user sync state
 *
 * Admin collections:
 *   throneSync/{studyId}         — study-level sync cursor (Cloud Function use only)
 *   throneUserMap/{throneUserId} — Throne userId → Firebase UID reverse lookup
 *     (maintained automatically by the syncThroneUserMap Cloud Function trigger)
 */

import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ThroneMetricRaw {
  id: string;
  ts: string;
  created: string;
  updated: string;
  deleted: string | null;
  sessionId: string;
  type: string;
  value: string;
  series: string;
  durationMicros: string;
}

interface ThroneSessionRaw {
  id: string;
  tags: string[];
  created: string;
  updated: string;
  startTs: string;
  endTs: string;
  deviceId: string;
  userId: string;
  status: string;
  metrics: ThroneMetricRaw[];
}

interface ExportResponse {
  studyId: string;
  sessions: ThroneSessionRaw[];
  page: number;
  count: number;
  hasMore: boolean;
}

export interface NormalizedSession {
  id: string;
  studyId: string;
  tags: string[];
  created: string;
  updated: string;
  startTs: string;
  endTs: string;
  deviceId: string;
  userId: string;
  status: string;
  metricCount: number;
}

export interface NormalizedMetric {
  id: string;
  studyId: string;
  sessionId: string;
  ts: string;
  created: string;
  updated: string;
  deleted: string | null;
  type: string;
  value: number | string;
  series: string;
  durationMicros: number;
}

interface SyncState {
  lastRunAt: string;
  lastVoidAt?: string | null;
  lastLtTs: string;
  lastStatus: "success" | "error";
  lastError: string | null;
  sessionCount: number;
  metricCount: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface ThroneConfig {
  apiKey: string;
  baseUrl: string;
  timezone: string;
  studyId: string;
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

function apiHeaders(config: ThroneConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "api-key": config.apiKey,
    "x-throne-tz": config.timezone,
  };
}

async function fetchExportPage(
  config: ThroneConfig,
  page: number,
  gtTs: string,
  ltTs: string,
): Promise<ExportResponse> {
  const url = `${config.baseUrl}/api.Research/Export`;
  logger.info(`Throne Export page=${page}`, {gtTs, ltTs});

  const res = await fetch(url, {
    method: "POST",
    headers: apiHeaders(config),
    body: JSON.stringify({
      studyId: config.studyId,
      gtTs,
      ltTs,
      page,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Throne Export page ${page} failed: ${res.status} ${body}`);
  }

  return res.json() as Promise<ExportResponse>;
}

// ─── Normalization ───────────────────────────────────────────────────────────

function normalizeValue(val: string): number | string {
  if (val === "" || val === null || val === undefined) return val;
  const n = Number(val);
  return Number.isFinite(n) ? n : val;
}

function normalizeSessions(
  pages: ExportResponse[],
  studyId: string,
): { sessions: NormalizedSession[]; metrics: NormalizedMetric[] } {
  const sessionMap = new Map<string, NormalizedSession>();
  const metricMap = new Map<string, NormalizedMetric>();

  for (const page of pages) {
    for (const s of page.sessions) {
      if (!sessionMap.has(s.id)) {
        sessionMap.set(s.id, {
          id: s.id,
          studyId,
          tags: s.tags,
          created: s.created,
          updated: s.updated,
          startTs: s.startTs,
          endTs: s.endTs,
          deviceId: s.deviceId,
          userId: s.userId,
          status: s.status,
          metricCount: s.metrics.length,
        });
      }

      for (const m of s.metrics) {
        if (!metricMap.has(m.id)) {
          metricMap.set(m.id, {
            id: m.id,
            studyId,
            sessionId: m.sessionId || s.id,
            ts: m.ts,
            created: m.created,
            updated: m.updated,
            deleted: m.deleted,
            type: m.type,
            value: normalizeValue(m.value),
            series: m.series,
            durationMicros: Number(m.durationMicros) || 0,
          });
        }
      }
    }
  }

  return {
    sessions: Array.from(sessionMap.values()),
    metrics: Array.from(metricMap.values()),
  };
}

// ─── Firestore Writer ────────────────────────────────────────────────────────

const BATCH_LIMIT = 400;

async function writeToFirestore(
  db: admin.firestore.Firestore,
  sessions: NormalizedSession[],
  metrics: NormalizedMetric[],
): Promise<void> {
  // Group sessions by Throne userId
  const sessionsByThroneUser = new Map<string, NormalizedSession[]>();
  for (const s of sessions) {
    const arr = sessionsByThroneUser.get(s.userId) ?? [];
    arr.push(s);
    sessionsByThroneUser.set(s.userId, arr);
  }

  // Build sessionId → throneUserId index for routing metrics to the right user
  const sessionThroneUser = new Map<string, string>();
  for (const s of sessions) {
    sessionThroneUser.set(s.id, s.userId);
  }

  // Group metrics by Throne userId
  const metricsByThroneUser = new Map<string, NormalizedMetric[]>();
  for (const m of metrics) {
    const throneUserId = sessionThroneUser.get(m.sessionId);
    if (!throneUserId) continue; // orphaned metric — skip
    const arr = metricsByThroneUser.get(throneUserId) ?? [];
    arr.push(m);
    metricsByThroneUser.set(throneUserId, arr);
  }

  // Build throneUserId → firebaseUid[] map. Supports multiple Firebase accounts
  // sharing the same Throne ID (e.g. during testing), writing data to all of them.
  const usersSnap = await db.collection("users")
    .where("throneUserId", "!=", null)
    .get();
  const throneToFirebase = new Map<string, string[]>();
  for (const doc of usersSnap.docs) {
    const tid = doc.data().throneUserId as string | undefined;
    if (tid) {
      const existing = throneToFirebase.get(tid) ?? [];
      existing.push(doc.id);
      throneToFirebase.set(tid, existing);
    }
  }
  logger.info("Throne→Firebase mappings found: " + throneToFirebase.size);

  // For each Throne userId, write to all mapped Firebase UIDs
  for (const [throneUserId, userSessions] of sessionsByThroneUser) {
    const firebaseUids = throneToFirebase.get(throneUserId);

    if (!firebaseUids || firebaseUids.length === 0) {
      logger.warn(
        "No users/{uid}.throneUserId match for throneUserId=" + throneUserId +
        " — skipping " + userSessions.length + " session(s)." +
        " Have the participant enter their Throne User ID in the app.",
      );
      continue;
    }

    const userMetrics = metricsByThroneUser.get(throneUserId) ?? [];
    const latestVoidAt = userSessions.reduce<string | null>((latest, session) => {
      if (!session.startTs) return latest;
      if (!latest) return session.startTs;
      return new Date(session.startTs).getTime() > new Date(latest).getTime() ?
        session.startTs :
        latest;
    }, null);

    for (const firebaseUid of firebaseUids) {
      // Write sessions in batches
      for (let i = 0; i < userSessions.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        for (const s of userSessions.slice(i, i + BATCH_LIMIT)) {
          batch.set(
            db.collection(`users/${firebaseUid}/throne_sessions`).doc(s.id),
            s,
            {merge: true},
          );
        }
        await batch.commit();
        logger.info(`Wrote sessions batch for uid=${firebaseUid}`);
      }

      // Write metrics in batches
      for (let i = 0; i < userMetrics.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        for (const m of userMetrics.slice(i, i + BATCH_LIMIT)) {
          batch.set(
            db.collection(`users/${firebaseUid}/throne_metrics`).doc(m.id),
            m,
            {merge: true},
          );
        }
        await batch.commit();
        logger.info(`Wrote metrics batch for uid=${firebaseUid}`);
      }

      // Write per-user sync state
      await db.doc(`users/${firebaseUid}/throne_sync/state`).set({
        lastRunAt: new Date().toISOString(),
        lastVoidAt: latestVoidAt,
        lastStatus: "success",
        sessionCount: userSessions.length,
        metricCount: userMetrics.length,
      }, {merge: true});

      logger.info(
        `Ingestion complete for uid=${firebaseUid}: ` +
        `${userSessions.length} sessions, ${userMetrics.length} metrics`,
      );
    }
  }
}

// ─── Main Ingestion Logic ────────────────────────────────────────────────────

export async function runThroneIngestion(
  config: ThroneConfig,
  opts?: { fullSync?: boolean },
): Promise<{ sessionCount: number; metricCount: number }> {
  const db = admin.firestore();
  const studyId = config.studyId;

  // Determine time window from study-level sync cursor
  const syncRef = db.collection("throneSync").doc(studyId);
  const syncDoc = await syncRef.get();

  const now = new Date();
  let gtTs: string;
  const ltTs = now.toISOString();

  if (opts?.fullSync) {
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    gtTs = oneYearAgo.toISOString();
    logger.info(`Full sync requested, fetching from ${gtTs}`);
  } else if (syncDoc.exists) {
    const data = syncDoc.data() as SyncState;
    gtTs = data.lastLtTs;
    logger.info(`Incremental sync from ${gtTs}`);
  } else {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    gtTs = sevenDaysAgo.toISOString();
    logger.info(`Initial sync from ${gtTs}`);
  }

  // Fetch all pages
  const allPages: ExportResponse[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const data = await fetchExportPage(config, page, gtTs, ltTs);
    allPages.push(data);
    logger.info(`Page ${page}: ${data.count} sessions, hasMore=${data.hasMore}`);
    hasMore = data.hasMore;
    page++;

    if (page > 100) {
      logger.warn("Exceeded 100 pages, stopping pagination");
      break;
    }
  }

  // Normalize
  const {sessions, metrics} = normalizeSessions(allPages, studyId);
  logger.info(`Normalized: ${sessions.length} sessions, ${metrics.length} metrics`);

  // Write to user-scoped paths
  if (sessions.length > 0 || metrics.length > 0) {
    await writeToFirestore(db, sessions, metrics);
  }

  // Advance study-level sync cursor
  const syncState: SyncState = {
    lastRunAt: now.toISOString(),
    lastLtTs: ltTs,
    lastStatus: "success",
    lastError: null,
    sessionCount: sessions.length,
    metricCount: metrics.length,
  };
  await syncRef.set(syncState, {merge: true});

  return {sessionCount: sessions.length, metricCount: metrics.length};
}
