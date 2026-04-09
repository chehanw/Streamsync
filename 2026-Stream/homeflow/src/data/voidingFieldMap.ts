/**
 * Voiding Field Map
 *
 * Canonical mapping between metric series names in Firestore and
 * the normalized field names used by ParsedVoidSession.
 */

/** Firestore metric series strings from the Throne ingestion pipeline. */
export const METRIC_SERIES = {
  AVG_FLOW:  'urine.flow.avg',
  MAX_FLOW:  'urine.flow.max',
  VOLUME:    'urine.volume',
  FLOW_RAW:  'urine.flow.raw',
  FLOW:      'urine.flow',
} as const;

export type MetricSeries = typeof METRIC_SERIES[keyof typeof METRIC_SERIES];

/** Human-readable labels for each metric field used in the UI. */
export const METRIC_LABELS: Record<VoidMetricKey, string> = {
  avgFlowRate:     'Avg Flow',
  maxFlowRate:     'Max Flow',
  voidedVolume:    'Volume',
  durationSeconds: 'Duration',
};

/** Units for each metric. */
export const METRIC_UNITS: Record<VoidMetricKey, string> = {
  avgFlowRate:     'mL/s',
  maxFlowRate:     'mL/s',
  voidedVolume:    'mL',
  durationSeconds: 's',
};

/** The four primary metric fields on a ParsedVoidSession. */
export type VoidMetricKey = 'avgFlowRate' | 'maxFlowRate' | 'voidedVolume' | 'durationSeconds';

/** Ordered list for the metric selector pills. */
export const METRIC_KEYS: VoidMetricKey[] = [
  'avgFlowRate',
  'voidedVolume',
  'durationSeconds',
  'maxFlowRate',
];
