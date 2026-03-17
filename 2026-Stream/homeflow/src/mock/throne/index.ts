/**
 * Mock Throne uroflow fixtures for development.
 * Exported from the Throne Research API via scripts/throne/exportThrone.ts.
 */

export interface ThroneSession {
  id: string;
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

export interface ThroneMetric {
  id: string;
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

export const sessions: ThroneSession[] = require('./sessions.json');
export const metrics: ThroneMetric[] = require('./metrics.json');

/** Return all metrics belonging to a given session, sorted by timestamp ascending. */
export function metricsForSession(sessionId: string): ThroneMetric[] {
  return metrics
    .filter((m) => m.sessionId === sessionId)
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
}

/** Return only sessions that have at least one metric recorded. */
export function sessionsWithMetrics(): ThroneSession[] {
  const ids = new Set(metrics.map((m) => m.sessionId));
  return sessions.filter((s) => ids.has(s.id));
}
