export type MetricType =
  | 'heartRate'
  | 'stepCount'
  | 'heartRateVariabilitySDNN';

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

function disabledMetricResult(): SyncMetricResult {
  return { ok: true, written: 0, skipped: 0 };
}

export async function getLastSync(
  _uid: string,
  _metricType: string,
): Promise<Date | null> {
  return null;
}

export async function setSyncState(
  _uid: string,
  _metricType: string,
  _patch: {
    lastSyncedAt?: unknown;
    lastStatus: 'ok' | 'error';
    lastError?: string;
  },
): Promise<void> {}

export async function syncMetric(
  _metricType: MetricType,
  _options?: { dryRun?: boolean },
): Promise<SyncMetricResult> {
  return disabledMetricResult();
}

export async function syncAllHealthKit(): Promise<SyncAllResult> {
  return {
    ok: true,
    results: {
      heartRate: disabledMetricResult(),
      stepCount: disabledMetricResult(),
      heartRateVariabilitySDNN: disabledMetricResult(),
    },
  };
}

export async function syncSleep(
  _options?: { dryRun?: boolean },
): Promise<SyncSleepResult> {
  return { ok: true, written: 0 };
}

export async function bootstrapHealthKitSync(): Promise<void> {
  if (__DEV__) {
    console.log('[HealthKit] HealthKit sync is temporarily disabled for crash isolation.');
  }
}
