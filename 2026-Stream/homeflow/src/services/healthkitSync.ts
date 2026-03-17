/**
 * HealthKit → Firestore incremental sync pipeline.
 *
 * Data model
 * ──────────
 *   users/{uid}/hk_{metricType}/{sampleId}
 *     value, unit, startDate, endDate, sourceName?, deviceName?,
 *     metadata?, createdAt, updatedAt
 *
 *   users/{uid}/hk_sync/{metricType}
 *     lastSyncedAt, lastRunAt, lastStatus, lastError?
 *
 * Idempotency
 * ───────────
 *   Each sample's Firestore doc ID is the HealthKit UUID, which is stable
 *   across retries. Re-syncing the same sample overwrites the same doc
 *   (no duplicates).
 *
 * Incremental sync
 * ────────────────
 *   On each run the pipeline reads lastSyncedAt from Firestore and queries
 *   HealthKit for samples whose startDate ≥ (lastSyncedAt − 5 min overlap).
 *   After a successful write, lastSyncedAt is advanced to the max endDate
 *   of the newly written samples.
 */

import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import {
  doc,
  getDoc,
  setDoc,
  writeBatch,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import type { FieldValue } from "firebase/firestore";
import {
  queryQuantitySamples,
  queryCategorySamples,
} from "@kingstinct/react-native-healthkit";
import type { QuantitySample } from "@kingstinct/react-native-healthkit";
import { mapCategorySampleToSleepSample, getSleepNightDate } from "@/lib/services/healthkit/mappers";

import { db, getAuth } from "./firestore";
import { syncClinicalNotes } from "./clinicalNotesSync";
import { syncFhirPrefill } from "./fhirPrefillSync";

// ── Metric configuration ──────────────────────────────────────────────────────

const METRIC_CONFIG = {
  heartRate: {
    identifier: "HKQuantityTypeIdentifierHeartRate" as const,
    unit: "count/min",
  },
  stepCount: {
    identifier: "HKQuantityTypeIdentifierStepCount" as const,
    unit: "count",
  },
  heartRateVariabilitySDNN: {
    identifier: "HKQuantityTypeIdentifierHeartRateVariabilitySDNN" as const,
    unit: "ms",
  },
} as const;

export type MetricType = keyof typeof METRIC_CONFIG;

// ── Internal types ────────────────────────────────────────────────────────────

interface SyncState {
  lastSyncedAt: Timestamp | null;
  lastRunAt: Timestamp;
  lastStatus: "ok" | "error";
  lastError?: string;
}

interface FirestoreSampleData {
  value: number;
  unit: string;
  startDate: Timestamp;
  endDate: Timestamp;
  sourceName?: string;
  deviceName?: string;
  metadata?: Record<string, unknown>;
  createdAt: FieldValue;
  updatedAt: FieldValue;
}

export interface SyncMetricResult {
  ok: boolean;
  written: number;
  skipped: number;
  error?: string;
}

export interface SyncAllResult {
  ok: boolean;
  results: Record<MetricType, SyncMetricResult>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const OVERLAP_WINDOW_MS = 5 * 60 * 1_000;
const DEFAULT_LOOKBACK_DAYS = 30;
const BATCH_SIZE = 400;

// ── buildSampleId ─────────────────────────────────────────────────────────────

async function buildSampleId(
  metricType: MetricType,
  sample: QuantitySample,
): Promise<string> {
  if (sample.uuid) return sample.uuid;

  const toDate = (d: unknown): Date =>
    d instanceof Date ? d : new Date(String(d));

  const startISO = toDate(sample.startDate).toISOString();
  const endISO = toDate(sample.endDate).toISOString();
  const sourceName = sample.sourceRevision?.source?.name ?? "";
  const unit = METRIC_CONFIG[metricType].unit;
  const input = [metricType, startISO, endISO, String(sample.quantity), unit, sourceName].join("|");

  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA1,
    input,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
}

// ── toFirestoreSample ─────────────────────────────────────────────────────────

function toFirestoreSample(
  metricType: MetricType,
  sample: QuantitySample,
): Omit<FirestoreSampleData, "createdAt" | "updatedAt"> {
  const toDate = (d: unknown): Date =>
    d instanceof Date ? d : new Date(String(d));

  const result: Omit<FirestoreSampleData, "createdAt" | "updatedAt"> = {
    value: sample.quantity,
    unit: METRIC_CONFIG[metricType].unit,
    startDate: Timestamp.fromDate(toDate(sample.startDate)),
    endDate: Timestamp.fromDate(toDate(sample.endDate)),
  };

  const sourceName = sample.sourceRevision?.source?.name;
  if (sourceName) result.sourceName = sourceName;

  const deviceName = sample.device?.name;
  if (deviceName) result.deviceName = deviceName;

  if (sample.metadata && Object.keys(sample.metadata).length > 0) {
    result.metadata = sample.metadata as Record<string, unknown>;
  }

  return result;
}

// ── fetchHealthKitSamples ─────────────────────────────────────────────────────

async function fetchHealthKitSamples(
  metricType: MetricType,
  sinceDate: Date,
): Promise<readonly QuantitySample[]> {
  if (Platform.OS !== "ios") return [];

  const config = METRIC_CONFIG[metricType];
  const startDate = new Date(sinceDate.getTime() - OVERLAP_WINDOW_MS);
  const endDate = new Date();

  return queryQuantitySamples(config.identifier as any, {
    limit: 0,
    unit: config.unit,
    filter: { date: { startDate, endDate } },
  });
}

// ── writeSamplesBatch ─────────────────────────────────────────────────────────

async function writeSamplesBatch(
  uid: string,
  metricType: MetricType,
  entries: { id: string; data: FirestoreSampleData }[],
): Promise<void> {
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    const collectionPath = `users/${uid}/hk_${metricType}`;
    console.log(`[HealthKit] Writing ${chunk.length} docs → ${collectionPath}/`);

    for (const { id, data } of chunk) {
      batch.set(doc(db, `${collectionPath}/${id}`), data);
    }

    await batch.commit();
    console.log(`[HealthKit] Batch committed (${chunk.length} docs) for ${metricType}`);
  }
}

// ── Sync state helpers ────────────────────────────────────────────────────────

export async function getLastSync(
  uid: string,
  metricType: string,
): Promise<Date | null> {
  const ref = doc(db, `users/${uid}/hk_sync/${metricType}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const state = snap.data() as Partial<SyncState>;
  return state.lastSyncedAt?.toDate() ?? null;
}

export async function setSyncState(
  uid: string,
  metricType: string,
  patch: {
    lastSyncedAt?: Timestamp;
    lastStatus: "ok" | "error";
    lastError?: string;
  },
): Promise<void> {
  const path = `users/${uid}/hk_sync/${metricType}`;
  console.log(`[HealthKit] setSyncState → ${path} status=${patch.lastStatus}`);
  const ref = doc(db, path);
  await setDoc(
    ref,
    { ...patch, lastRunAt: serverTimestamp() },
    { merge: true },
  ).then(() => {
    console.log(`[HealthKit] setSyncState written OK → ${path}`);
  }).catch((err) => {
    console.error(`[HealthKit] setSyncState write failed → ${path}:`, err);
    throw err;
  });
}

// ── syncMetric ────────────────────────────────────────────────────────────────

export async function syncMetric(
  metricType: MetricType,
  options?: { dryRun?: boolean },
): Promise<SyncMetricResult> {
  const uid = getAuth().currentUser?.uid;
  if (!uid) {
    return { ok: false, written: 0, skipped: 0, error: "no-auth: user is not signed in" };
  }

  try {
    const lastSync = await getLastSync(uid, metricType);
    const sinceDate =
      lastSync ??
      new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1_000);

    const hkSamples = await fetchHealthKitSamples(metricType, sinceDate);
    if (hkSamples.length === 0) {
      return { ok: true, written: 0, skipped: 0 };
    }

    const entries: { id: string; data: FirestoreSampleData }[] =
      await Promise.all(
        hkSamples.map(async (sample) => {
          const id = await buildSampleId(metricType, sample);
          const data: FirestoreSampleData = {
            ...toFirestoreSample(metricType, sample),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          return { id, data };
        }),
      );

    if (!options?.dryRun) {
      await writeSamplesBatch(uid, metricType, entries);

      const toDate = (d: unknown): Date =>
        d instanceof Date ? d : new Date(String(d));

      const maxEndDate = hkSamples.reduce<Date>((max, s) => {
        const end = toDate(s.endDate);
        return end > max ? end : max;
      }, new Date(0));

      await setSyncState(uid, metricType, {
        lastSyncedAt: Timestamp.fromDate(maxEndDate),
        lastStatus: "ok",
      });
    }

    return { ok: true, written: entries.length, skipped: 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setSyncState(uid, metricType, {
      lastStatus: "error",
      lastError: message,
    }).catch(() => {});
    return { ok: false, written: 0, skipped: 0, error: message };
  }
}

// ── syncAllHealthKit ──────────────────────────────────────────────────────────

export async function syncAllHealthKit(): Promise<SyncAllResult> {
  const metricTypes = Object.keys(METRIC_CONFIG) as MetricType[];
  const results = {} as Record<MetricType, SyncMetricResult>;
  let allOk = true;

  for (const metricType of metricTypes) {
    results[metricType] = await syncMetric(metricType);
    if (!results[metricType].ok) allOk = false;
  }

  return { ok: allOk, results };
}

// ── Sleep sync ────────────────────────────────────────────────────────────────

const SLEEP_ANALYSIS_IDENTIFIER = "HKCategoryTypeIdentifierSleepAnalysis" as const;
const SLEEP_SYNC_KEY = "sleepAnalysis";

interface FirestoreSleepSampleData {
  stage: string;
  stageValue: number;
  nightDate: string;
  startDate: Timestamp;
  endDate: Timestamp;
  durationMinutes: number;
  sourceName?: string;
  deviceName?: string;
  createdAt: FieldValue;
  updatedAt: FieldValue;
}

export interface SyncSleepResult {
  ok: boolean;
  written: number;
  error?: string;
}

async function buildSleepSampleId(sample: {
  uuid?: string;
  startDate: Date | string;
  endDate: Date | string;
  value: number;
  sourceRevision?: { source?: { name?: string } };
}): Promise<string> {
  if (sample.uuid) return sample.uuid;

  const toDate = (d: unknown): Date =>
    d instanceof Date ? d : new Date(String(d));

  const sourceName = sample.sourceRevision?.source?.name ?? "";
  const input = [
    SLEEP_SYNC_KEY,
    toDate(sample.startDate).toISOString(),
    toDate(sample.endDate).toISOString(),
    String(sample.value),
    sourceName,
  ].join("|");

  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA1,
    input,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
}

/**
 * Syncs sleep analysis samples from HealthKit to Firestore.
 *
 * Firestore path: users/{uid}/hk_sleepAnalysis/{sampleId}
 * Sync state:     users/{uid}/hk_sync/sleepAnalysis
 */
export async function syncSleep(
  options?: { dryRun?: boolean },
): Promise<SyncSleepResult> {
  if (Platform.OS !== "ios") return { ok: true, written: 0 };

  const uid = getAuth().currentUser?.uid;
  if (!uid) {
    return { ok: false, written: 0, error: "no-auth: user is not signed in" };
  }

  try {
    const lastSync = await getLastSync(uid, SLEEP_SYNC_KEY);
    const sinceDate =
      lastSync ??
      new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1_000);

    const startDate = new Date(sinceDate.getTime() - OVERLAP_WINDOW_MS);
    const endDate = new Date();

    const rawSamples = await queryCategorySamples(SLEEP_ANALYSIS_IDENTIFIER as any, {
      limit: 0,
      filter: { date: { startDate, endDate } },
    });

    if (!rawSamples || rawSamples.length === 0) {
      return { ok: true, written: 0 };
    }

    const toDate = (d: unknown): Date =>
      d instanceof Date ? d : new Date(String(d));

    const entries: { id: string; data: FirestoreSleepSampleData }[] =
      await Promise.all(
        rawSamples.map(async (raw) => {
          const id = await buildSleepSampleId(raw as any);
          const mapped = mapCategorySampleToSleepSample(raw as any);
          const nightDate = getSleepNightDate(toDate(raw.startDate));

          const data: FirestoreSleepSampleData = {
            stage: mapped.stage,
            stageValue: (raw as any).value,
            nightDate,
            startDate: Timestamp.fromDate(toDate(raw.startDate)),
            endDate: Timestamp.fromDate(toDate(raw.endDate)),
            durationMinutes: mapped.durationMinutes,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          const sourceName = (raw as any).sourceRevision?.source?.name;
          if (sourceName) data.sourceName = sourceName;
          const deviceName = (raw as any).device?.name;
          if (deviceName) data.deviceName = deviceName;

          return { id, data };
        }),
      );

    if (!options?.dryRun) {
      const basePath = `users/${uid}/hk_${SLEEP_SYNC_KEY}`;
      console.log(`[HealthKit] Writing ${entries.length} sleep samples → ${basePath}/`);

      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const chunk = entries.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const { id, data } of chunk) {
          batch.set(doc(db, `${basePath}/${id}`), data);
        }
        await batch.commit();
        console.log(`[HealthKit] Sleep batch committed (${chunk.length} docs)`);
      }

      const maxEndDate = rawSamples.reduce<Date>((max, s) => {
        const end = toDate((s as any).endDate);
        return end > max ? end : max;
      }, new Date(0));

      await setSyncState(uid, SLEEP_SYNC_KEY, {
        lastSyncedAt: Timestamp.fromDate(maxEndDate),
        lastStatus: "ok",
      });
    }

    return { ok: true, written: entries.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setSyncState(uid, SLEEP_SYNC_KEY, {
      lastStatus: "error",
      lastError: message,
    }).catch(() => {});
    return { ok: false, written: 0, error: message };
  }
}

// ── bootstrapHealthKitSync ────────────────────────────────────────────────────

/**
 * Initiates a full HealthKit sync after login.
 * Designed to be called fire-and-forget from the auth gate.
 * All errors are caught internally and logged — this never throws.
 */
export async function bootstrapHealthKitSync(): Promise<void> {
  console.log("[HealthKit] bootstrapHealthKitSync: starting");
  try {
    // Quantity metrics and sleep run in parallel first.
    // Clinical notes and FHIR prefill run after — HealthKit serializes concurrent
    // queries, so clinical record APIs return empty when competing with the
    // quantity metric batch.
    const [hkResult, sleepResult] = await Promise.all([
      syncAllHealthKit(),
      syncSleep(),
    ]);
    const [clinicalResult, fhirResult] = await Promise.all([
      syncClinicalNotes(),
      syncFhirPrefill(),
    ]);

    if (__DEV__) {
      // Log detailed sync results only in development — these objects contain
      // health metric categories and clinical data counts (PHI-adjacent).
      if (hkResult.ok) {
        console.log("[HealthKit] bootstrapHealthKitSync: quantity metrics synced OK", hkResult.results);
      } else {
        console.warn("[HealthKit] bootstrapHealthKitSync: quantity metrics had errors", hkResult.results);
      }

      if (sleepResult.ok) {
        console.log(`[HealthKit] bootstrapHealthKitSync: sleep synced OK — written: ${sleepResult.written}`);
      } else {
        console.warn("[HealthKit] bootstrapHealthKitSync: sleep sync error:", sleepResult.error);
      }

      if (clinicalResult.ok) {
        console.log(
          `[HealthKit] bootstrapHealthKitSync: clinical notes synced OK — uploaded: ${clinicalResult.uploaded}, skipped: ${clinicalResult.skipped}`,
        );
      } else {
        console.warn("[HealthKit] bootstrapHealthKitSync: clinical notes sync error:", clinicalResult.error);
      }

      if (fhirResult.ok) {
        console.log("[HealthKit] bootstrapHealthKitSync: FHIR prefill synced OK", fhirResult.sourceRecordCounts);
      } else {
        console.warn("[HealthKit] bootstrapHealthKitSync: FHIR prefill sync error:", fhirResult.error);
      }
    }
  } catch (err) {
    console.error("[HealthKit] bootstrapHealthKitSync: unexpected error:", err);
  }
}
