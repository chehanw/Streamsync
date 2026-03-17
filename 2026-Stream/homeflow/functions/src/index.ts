/**
 * StreamSync Cloud Functions
 *
 * - throneIngestDaily:   Scheduled daily at 3 AM PT, syncs Throne data to Firestore
 * - syncThroneNow:       HTTP trigger for manual/dev sync (requires x-admin-token header)
 * - syncThroneUserMap:   Firestore trigger — keeps throneUserMap in sync when a user's
 *                        throneUserId field is set or changed by the study coordinator
 *
 * Required env vars (functions/.env):
 *   THRONE_API_KEY, THRONE_BASE_URL, THRONE_STUDY_ID, ADMIN_TOKEN
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

admin.initializeApp();

setGlobalOptions({maxInstances: 10});

// ─── Config ──────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function getThroneConfig(): ThroneConfig {
  return {
    apiKey: requireEnv("THRONE_API_KEY"),
    baseUrl: requireEnv("THRONE_BASE_URL"),
    timezone: process.env.THRONE_TIMEZONE || "America/Los_Angeles",
    studyId: requireEnv("THRONE_STUDY_ID"),
  };
}

// ─── Scheduled Daily Ingestion ───────────────────────────────────────────────

export const throneIngestDaily = onSchedule(
  {
    schedule: "0 3 * * *",
    timeZone: "America/Los_Angeles",
  },
  async () => {
    logger.info("Starting scheduled Throne ingestion");
    const studyId = process.env.THRONE_STUDY_ID || "unknown";

    try {
      const config = getThroneConfig();
      const result = await runThroneIngestion(config);
      logger.info("Throne ingestion complete", result);
    } catch (err) {
      logger.error("Throne ingestion failed", err);

      const db = admin.firestore();
      await db.collection("throneSync").doc(studyId).set({
        lastRunAt: new Date().toISOString(),
        lastStatus: "error",
        lastError: err instanceof Error ? err.message : String(err),
      }, {merge: true});

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
    const db = admin.firestore();
    const studyId = process.env.THRONE_STUDY_ID ?? "unknown";

    // Rate limit: skip if the study already synced within the last hour
    const syncDoc = await db.collection("throneSync").doc(studyId).get();
    if (syncDoc.exists) {
      const lastRunAt = syncDoc.data()?.lastRunAt as string | undefined;
      if (lastRunAt) {
        const elapsed = Date.now() - new Date(lastRunAt).getTime();
        if (elapsed < 60 * 60 * 1000) {
          logger.info(`Skipping triggered sync: last run was ${Math.round(elapsed / 60000)}m ago`);
          return;
        }
      }
    }

    logger.info("App-open sync request received — starting ingestion");
    try {
      const config = getThroneConfig();
      const result = await runThroneIngestion(config);
      logger.info("App-open sync complete", result);
    } catch (err) {
      logger.error("App-open sync failed", err);
      throw err;
    }
  },
);

// ─── Manual HTTP Trigger ─────────────────────────────────────────────────────

export const syncThroneNow = onRequest(async (req, res) => {
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
    const config = getThroneConfig();
    const fullSync = req.body?.fullSync === true;
    const result = await runThroneIngestion(config, {fullSync});
    res.status(200).json({status: "ok", fullSync, ...result});
  } catch (err) {
    logger.error("Manual Throne sync failed", err);
    res.status(500).json({
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
