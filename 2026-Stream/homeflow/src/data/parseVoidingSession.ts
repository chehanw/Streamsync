/**
 * Voiding Session Parser
 *
 * Normalizes raw ThroneSession + ThroneMetric arrays into a clean
 * ParsedVoidSession struct with safe number coercion and Date normalization.
 * Never throws on missing or malformed data.
 */

import type { ThroneSession, ThroneMetric } from '@/src/services/throneFirestore';
import { METRIC_SERIES } from './voidingFieldMap';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedVoidSession {
  // Raw session fields (preserved for list display + navigation)
  id: string;
  tags: string[];
  startTs: string;
  endTs: string;
  status: string;
  metricCount: number;

  // Normalized
  timestamp: Date;             // reliable Date from startTs

  // Metrics (null when not present in data)
  avgFlowRate: number | null;      // mL/s  (urine.flow.avg)
  maxFlowRate: number | null;      // mL/s  (urine.flow.max)
  voidedVolume: number | null;     // mL    (urine.volume)
  durationSeconds: number | null;  // s     (derived from endTs - startTs)

  // Derived
  volumePerSecond: number | null;  // mL/s  (voidedVolume / durationSeconds)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safe numeric coercion — returns null for NaN, Infinity, or negatives. */
function safeNum(v: number | string | undefined | null): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Find the first metric with the given series, ignoring soft-deleted entries. */
function findMetric(metrics: ThroneMetric[], series: string): ThroneMetric | undefined {
  return metrics.find(m => m.series === series && m.deleted == null);
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse a single ThroneSession with its pre-loaded metrics into a
 * ParsedVoidSession. Safe to call with an empty metrics array.
 */
export function parseSessionWithMetrics(
  session: ThroneSession,
  metrics: ThroneMetric[],
): ParsedVoidSession {
  // Timestamp — prefer startTs, tolerate ISO or Firestore-style strings
  const timestamp = new Date(session.startTs);

  // Duration from boundary timestamps (most reliable source)
  let durationSeconds: number | null = null;
  if (session.startTs && session.endTs) {
    const ms = new Date(session.endTs).getTime() - new Date(session.startTs).getTime();
    const sec = Math.round(ms / 1000);
    durationSeconds = sec > 0 ? sec : null;
  }

  // Metric lookups
  const avgFlowRate  = safeNum(findMetric(metrics, METRIC_SERIES.AVG_FLOW)?.value);
  const maxFlowRate  = safeNum(findMetric(metrics, METRIC_SERIES.MAX_FLOW)?.value);
  const voidedVolume = safeNum(findMetric(metrics, METRIC_SERIES.VOLUME)?.value);

  // If avg is missing, try computing from raw flow points
  let resolvedAvgFlow = avgFlowRate;
  if (resolvedAvgFlow === null) {
    const rawSeries = METRIC_SERIES.FLOW_RAW;
    const flowSeries = METRIC_SERIES.FLOW;
    const rawPoints = metrics
      .filter(m => (m.series === rawSeries || m.series === flowSeries) && m.deleted == null)
      .map(m => safeNum(m.value))
      .filter((v): v is number => v !== null);
    if (rawPoints.length > 0) {
      resolvedAvgFlow = rawPoints.reduce((a, b) => a + b, 0) / rawPoints.length;
    }
  }

  // Derived: volume per second
  const volumePerSecond =
    voidedVolume !== null && durationSeconds !== null && durationSeconds > 0
      ? voidedVolume / durationSeconds
      : null;

  return {
    id:             session.id,
    tags:           session.tags ?? [],
    startTs:        session.startTs,
    endTs:          session.endTs,
    status:         session.status,
    metricCount:    session.metricCount,
    timestamp,
    avgFlowRate:    resolvedAvgFlow,
    maxFlowRate,
    voidedVolume,
    durationSeconds,
    volumePerSecond,
  };
}

/** Convenience — parse a session when metrics have not yet been fetched. */
export function parseSessionNoMetrics(session: ThroneSession): ParsedVoidSession {
  return parseSessionWithMetrics(session, []);
}
