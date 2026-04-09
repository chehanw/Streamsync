/**
 * Voiding Aggregation
 *
 * Client-side aggregation over ParsedVoidSession arrays.
 * All functions are pure (no side effects) and NaN-safe.
 */

import type { ParsedVoidSession } from './parseVoidingSession';
import type { VoidMetricKey } from './voidingFieldMap';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RangeKey = '1d' | '1w' | '1m';
export type ComparisonWindowDays = 14 | 30;
export type PostWindowMode = 'immediate' | 'recent';

export interface BucketPoint {
  label: string;
  value: number;   // mean value for the bucket
  count: number;   // number of sessions contributing a non-null value
}

export interface SummaryStats {
  avgFlowRate:  number | null;
  maxFlowRate:  number | null;
  avgVolume:    number | null;
  avgDuration:  number | null;
  voidCount:    number;
}

export interface ComparisonStats {
  pre:            SummaryStats;
  post:           SummaryStats;
  deltaFlow:      number | null;     // post - pre (mL/s)
  deltaFlowPct:   number | null;     // % change
  deltaVolume:    number | null;     // post - pre (mL)
  deltaVolumePct: number | null;     // % change
}

export interface ComparisonWindows {
  preSessions:  ParsedVoidSession[];
  postSessions: ParsedVoidSession[];
}

// ─── Range Filtering ──────────────────────────────────────────────────────────

export function filterByRange(
  sessions: ParsedVoidSession[],
  range: RangeKey,
): ParsedVoidSession[] {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  switch (range) {
    case '1d':
      break; // today only
    case '1w':
      start.setDate(start.getDate() - 6);
      break;
    case '1m':
      start.setMonth(start.getMonth() - 1);
      break;
  }

  const startMs = start.getTime();
  const endMs   = end.getTime();
  return sessions.filter(s => {
    const t = s.timestamp.getTime();
    return t >= startMs && t <= endMs;
  });
}

// ─── Bucketing ────────────────────────────────────────────────────────────────

/** Collect values from sessions into a labeled bucket map. */
function collectBuckets(
  sessions: ParsedVoidSession[],
  keyFn: (s: ParsedVoidSession) => string,
  metric: VoidMetricKey,
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const s of sessions) {
    const v = s[metric];
    if (v === null) continue;
    const key = keyFn(s);
    const arr = map.get(key);
    if (arr) arr.push(v);
    else map.set(key, [v]);
  }
  return map;
}

function averageMap(map: Map<string, number[]>, orderedKeys: string[]): BucketPoint[] {
  return orderedKeys
    .filter(k => map.has(k))
    .map(k => {
      const vals = map.get(k)!;
      return {
        label: k,
        value: vals.reduce((a, b) => a + b, 0) / vals.length,
        count: vals.length,
      };
    });
}

/**
 * Bucket sessions by time period and compute the mean metric value per bucket.
 * Returns an ordered array suitable for charting.
 */
export function bucketSeries(
  sessions: ParsedVoidSession[],
  range: RangeKey,
  metric: VoidMetricKey,
): BucketPoint[] {
  if (sessions.length === 0) return [];

  if (range === '1d') {
    // Bucket by hour of day
    const map = collectBuckets(sessions, s => String(s.timestamp.getHours()), metric);
    const hours = Array.from({ length: 24 }, (_, i) => String(i));
    return averageMap(map, hours).map(b => ({
      ...b,
      label: formatHourLabel(Number(b.label)),
    }));
  }

  if (range === '1w') {
    // Bucket by calendar day over the past 7 days
    const today = new Date();
    const dayKeys: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dayKeys.push(dayLabel(d));
    }
    const map = collectBuckets(sessions, s => dayLabel(s.timestamp), metric);
    return averageMap(map, dayKeys);
  }

  // '1m': bucket by week (each 7-day period counting back from today)
  const now = Date.now();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const keyFn = (s: ParsedVoidSession): string => {
    const weeksAgo = Math.floor((now - s.timestamp.getTime()) / msPerWeek);
    return String(weeksAgo);
  };
  const map = collectBuckets(sessions, keyFn, metric);
  const weekKeys = Array.from({ length: 5 }, (_, i) => String(i));
  return averageMap(map, weekKeys).map(b => ({
    ...b,
    label: Number(b.label) === 0 ? 'This wk' : `${Number(b.label) + 1}w ago`,
  })).reverse(); // oldest first
}

// ─── Summary Stats ────────────────────────────────────────────────────────────

function safeAvg(vals: (number | null)[]): number | null {
  const valid = vals.filter((v): v is number => v !== null && Number.isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function computeSummaryStats(sessions: ParsedVoidSession[]): SummaryStats {
  if (sessions.length === 0) {
    return { avgFlowRate: null, maxFlowRate: null, avgVolume: null, avgDuration: null, voidCount: 0 };
  }

  return {
    avgFlowRate: safeAvg(sessions.map(s => s.avgFlowRate)),
    maxFlowRate: safeAvg(sessions.map(s => s.maxFlowRate)),
    avgVolume:   safeAvg(sessions.map(s => s.voidedVolume)),
    avgDuration: safeAvg(sessions.map(s => s.durationSeconds)),
    voidCount:   sessions.length,
  };
}

// ─── Comparison ───────────────────────────────────────────────────────────────

export function computeComparisonStats(
  preSessions: ParsedVoidSession[],
  postSessions: ParsedVoidSession[],
): ComparisonStats {
  const pre  = computeSummaryStats(preSessions);
  const post = computeSummaryStats(postSessions);

  const deltaFlow = (pre.avgFlowRate !== null && post.avgFlowRate !== null)
    ? post.avgFlowRate - pre.avgFlowRate
    : null;
  const deltaFlowPct = (deltaFlow !== null && pre.avgFlowRate !== null && pre.avgFlowRate !== 0)
    ? (deltaFlow / pre.avgFlowRate) * 100
    : null;

  const deltaVolume = (pre.avgVolume !== null && post.avgVolume !== null)
    ? post.avgVolume - pre.avgVolume
    : null;
  const deltaVolumePct = (deltaVolume !== null && pre.avgVolume !== null && pre.avgVolume !== 0)
    ? (deltaVolume / pre.avgVolume) * 100
    : null;

  return { pre, post, deltaFlow, deltaFlowPct, deltaVolume, deltaVolumePct };
}

/**
 * Split sessions into pre- and post-surgery windows.
 *
 * PRE window:  [surgeryDate - windowDays, surgeryDate)
 * POST window (immediate): [surgeryDate, surgeryDate + windowDays)
 * POST window (recent):    [now - windowDays, now)
 */
export function filterComparisonWindows(
  sessions: ParsedVoidSession[],
  surgeryDate: Date,
  windowDays: ComparisonWindowDays,
  postMode: PostWindowMode,
): ComparisonWindows {
  const surMs    = surgeryDate.getTime();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  const preSessions = sessions.filter(s => {
    const t = s.timestamp.getTime();
    return t >= surMs - windowMs && t < surMs;
  });

  let postSessions: ParsedVoidSession[];
  if (postMode === 'immediate') {
    postSessions = sessions.filter(s => {
      const t = s.timestamp.getTime();
      return t >= surMs && t < surMs + windowMs;
    });
  } else {
    const recentStart = Date.now() - windowMs;
    postSessions = sessions.filter(s => s.timestamp.getTime() >= recentStart);
  }

  return { preSessions, postSessions };
}

// ─── Grouping (for session list) ──────────────────────────────────────────────

export interface DayGroup {
  title: string;
  date:  string;
  data:  ParsedVoidSession[];
}

export function groupByDay(sessions: ParsedVoidSession[]): DayGroup[] {
  const groups: Record<string, ParsedVoidSession[]> = {};

  for (const s of sessions) {
    const key = s.timestamp.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }

  return Object.entries(groups)
    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
    .map(([title, data]) => ({ title, date: title, data }));
}

// ─── Label helpers ────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayLabel(d: Date): string {
  return DAY_LABELS[d.getDay()];
}

function formatHourLabel(h: number): string {
  if (h === 0)  return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}
