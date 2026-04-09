/**
 * HealthKit Mappers
 *
 * Maps raw HealthKit data to our normalized types.
 */

import { CategoryValueSleepAnalysis } from '@kingstinct/react-native-healthkit';
import type { QuantitySample } from '@kingstinct/react-native-healthkit';
import { SleepStage, type SleepSample } from './types';

// ── Date helpers ────────────────────────────────────────────────────

/** Format a Date to YYYY-MM-DD */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Get start of day (00:00:00.000) in local timezone */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get end of day (23:59:59.999) in local timezone */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Build a DateRange for the last N days (including today) */
export function getDateRange(days: number): { startDate: Date; endDate: Date } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { startDate: startOfDay(start), endDate: endOfDay(end) };
}

/** Get all YYYY-MM-DD keys between two dates */
export function getDateKeysInRange(startDate: Date, endDate: Date): string[] {
  const keys: string[] = [];
  const current = startOfDay(new Date(startDate));
  const end = startOfDay(new Date(endDate));
  while (current <= end) {
    keys.push(formatDateKey(current));
    current.setDate(current.getDate() + 1);
  }
  return keys;
}

// ── Quantity sample helpers ─────────────────────────────────────────

/** Group quantity samples by YYYY-MM-DD */
export function bucketSamplesByDay(
  samples: readonly QuantitySample[],
): Map<string, QuantitySample[]> {
  const map = new Map<string, QuantitySample[]>();
  for (const sample of samples) {
    const key = formatDateKey(new Date(sample.startDate));
    const bucket = map.get(key) ?? [];
    bucket.push(sample);
    map.set(key, bucket);
  }
  return map;
}

/** Sum all quantity values in a list of samples */
export function sumSamples(samples: readonly QuantitySample[]): number {
  return samples.reduce((sum, s) => sum + s.quantity, 0);
}

/** Get min/max/avg from samples */
export function statsSamples(samples: readonly QuantitySample[]): {
  min: number;
  max: number;
  average: number;
  sampleCount: number;
} {
  if (samples.length === 0) {
    return { min: 0, max: 0, average: 0, sampleCount: 0 };
  }
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const s of samples) {
    if (s.quantity < min) min = s.quantity;
    if (s.quantity > max) max = s.quantity;
    sum += s.quantity;
  }
  return {
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
    average: Math.round((sum / samples.length) * 10) / 10,
    sampleCount: samples.length,
  };
}

// ── Sleep mappers ───────────────────────────────────────────────────

/** Map HKCategoryValueSleepAnalysis to our SleepStage enum */
export function mapSleepValue(value: number): SleepStage {
  switch (value) {
    case CategoryValueSleepAnalysis.inBed:
      return SleepStage.InBed;
    case CategoryValueSleepAnalysis.awake:
      return SleepStage.Awake;
    case CategoryValueSleepAnalysis.asleepCore:
      return SleepStage.Core;
    case CategoryValueSleepAnalysis.asleepDeep:
      return SleepStage.Deep;
    case CategoryValueSleepAnalysis.asleepREM:
      return SleepStage.REM;
    case CategoryValueSleepAnalysis.asleepUnspecified:
      return SleepStage.AsleepUnspecified;
    default:
      return SleepStage.AsleepUnspecified;
  }
}

/** Convert a raw HK sleep category sample to our SleepSample */
export function mapCategorySampleToSleepSample(raw: {
  value: number;
  startDate: Date;
  endDate: Date;
}): SleepSample {
  const start = new Date(raw.startDate);
  const end = new Date(raw.endDate);
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
  return {
    stage: mapSleepValue(raw.value),
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    durationMinutes: Math.max(0, durationMinutes),
  };
}

/**
 * Determine the "night date" for a sleep sample.
 * Sleep that starts before 6 PM belongs to the previous night.
 * Sleep that starts after 6 PM belongs to that night's date.
 */
export function getSleepNightDate(startDate: Date): string {
  const d = new Date(startDate);
  // If sleep started before 6 PM, it likely belongs to the previous night
  if (d.getHours() < 18) {
    d.setDate(d.getDate() - 1);
  }
  return formatDateKey(d);
}

/** Calculate sedentary minutes estimate */
export function estimateSedentaryMinutes(
  exerciseMinutes: number,
  moveMinutes: number,
  standMinutes: number,
): number {
  // Assume 16 waking hours = 960 minutes
  const WAKING_MINUTES = 960;
  const active = exerciseMinutes + moveMinutes + standMinutes;
  return Math.max(0, Math.round(WAKING_MINUTES - active));
}
