/**
 * HealthKit → Firestore incremental sync pipeline.
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

export interface SyncSleepResult {
  ok: boolean;
  written: number;
  error?: string;
}

const OVERLAP_WINDOW_MS = 5 * 60 * 1_000;
const DEFAULT_LOOKBACK_DAYS = 30;
const BATCH_SIZE = 400;

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

async function writeSamplesBatch(
  uid: string,
  metricType: MetricType,
  entries: { id: string; data: FirestoreSampleData }[],
): Promise<void> {
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    const collectionPath = `users/${uid}/hk_${metricType}`;

    for (const { id, data } of chunk) {
      batch.set(doc(db, `${collectionPath}/${id}`), data);
    }

    await batch.commit();
  }
}

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
  const ref = doc(db, `users/${uid}/hk_sync/${metricType}`);
  await setDoc(
    ref,
    { ...patch, lastRunAt: serverTimestamp() },
    { merge: true },
  );
}

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

    let maxEndDate = sinceDate;
    const entries = await Promise.all(
      hkSamples.map(async (sample) => {
        const id = await buildSampleId(metricType, sample);
        const data = {
          ...toFirestoreSample(metricType, sample),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const endDate = sample.endDate instanceof Date
          ? sample.endDate
          : new Date(String(sample.endDate));
        if (endDate > maxEndDate) maxEndDate = endDate;

        return { id, data };
      }),
    );

    if (!options?.dryRun) {
      await writeSamplesBatch(uid, metricType, entries);
      await setSyncState(uid, metricType, {
        lastSyncedAt: Timestamp.fromDate(maxEndDate),
        lastStatus: "ok",
        lastError: "",
      });
    }

    return { ok: true, written: entries.length, skipped: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (uid) {
      await setSyncState(uid, metricType, {
        lastStatus: "error",
        lastError: message,
      }).catch(() => {});
    }
    return { ok: false, written: 0, skipped: 0, error: message };
  }
}

export async function syncAllHealthKit(): Promise<SyncAllResult> {
  const metricTypes = Object.keys(METRIC_CONFIG) as MetricType[];
  const pairs = await Promise.all(
    metricTypes.map(async (metricType) => [metricType, await syncMetric(metricType)] as const),
  );
  return {
    ok: pairs.every(([, result]) => result.ok),
    results: Object.fromEntries(pairs) as Record<MetricType, SyncMetricResult>,
  };
}

export async function syncSleep(
  options?: { dryRun?: boolean },
): Promise<SyncSleepResult> {
  const uid = getAuth().currentUser?.uid;
  if (!uid) {
    return { ok: false, written: 0, error: "no-auth: user is not signed in" };
  }

  if (Platform.OS !== "ios") {
    return { ok: true, written: 0 };
  }

  try {
    const lastSync = await getLastSync(uid, "sleep");
    const sinceDate =
      lastSync ??
      new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1_000);
    const startDate = new Date(sinceDate.getTime() - OVERLAP_WINDOW_MS);
    const endDate = new Date();

    const rawSamples = await queryCategorySamples("HKCategoryTypeIdentifierSleepAnalysis", {
      limit: 0,
      filter: { date: { startDate, endDate } },
    });

    if (!rawSamples || rawSamples.length === 0) {
      return { ok: true, written: 0 };
    }

    const nightMap = new Map<string, ReturnType<typeof mapCategorySampleToSleepSample>[]>();
    let maxEndDate = sinceDate;

    for (const raw of rawSamples) {
      const sample = mapCategorySampleToSleepSample(raw as any);
      const nightKey = getSleepNightDate(new Date(raw.startDate));
      const bucket = nightMap.get(nightKey) ?? [];
      bucket.push(sample);
      nightMap.set(nightKey, bucket);

      const rawEnd = raw.endDate instanceof Date ? raw.endDate : new Date(String(raw.endDate));
      if (rawEnd > maxEndDate) maxEndDate = rawEnd;
    }

    if (!options?.dryRun) {
      const batch = writeBatch(db);
      for (const [date, samples] of nightMap) {
        batch.set(doc(db, `users/${uid}/hk_sleep/${date}`), {
          date,
          samples,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
      await setSyncState(uid, "sleep", {
        lastSyncedAt: Timestamp.fromDate(maxEndDate),
        lastStatus: "ok",
        lastError: "",
      });
    }

    return { ok: true, written: nightMap.size };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setSyncState(uid, "sleep", {
      lastStatus: "error",
      lastError: message,
    }).catch(() => {});
    return { ok: false, written: 0, error: message };
  }
}

export async function bootstrapHealthKitSync(): Promise<void> {
  await Promise.allSettled([
    syncAllHealthKit(),
    syncSleep(),
    syncClinicalNotes(),
    syncFhirPrefill(),
  ]);
}
