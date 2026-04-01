import { SleepStage, type SleepSample } from './types';

type QuantitySample = {
  startDate: Date | string;
  quantity: number;
};

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function getDateRange(days: number): { startDate: Date; endDate: Date } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { startDate: startOfDay(start), endDate: endOfDay(end) };
}

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

export function sumSamples(samples: readonly QuantitySample[]): number {
  return samples.reduce((sum, s) => sum + s.quantity, 0);
}

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

export function mapSleepValue(value: number): SleepStage {
  switch (value) {
    case 0:
      return SleepStage.InBed;
    case 2:
      return SleepStage.Awake;
    case 4:
      return SleepStage.Core;
    case 5:
      return SleepStage.Deep;
    case 6:
      return SleepStage.REM;
    case 1:
      return SleepStage.AsleepUnspecified;
    default:
      return SleepStage.AsleepUnspecified;
  }
}

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

export function getSleepNightDate(startDate: Date): string {
  const d = new Date(startDate);
  if (d.getHours() < 18) {
    d.setDate(d.getDate() - 1);
  }
  return formatDateKey(d);
}

export function estimateSedentaryMinutes(
  exerciseMinutes: number,
  moveMinutes: number,
  standMinutes: number,
): number {
  const wakingMinutes = 960;
  const active = exerciseMinutes + moveMinutes + standMinutes;
  return Math.max(0, Math.round(wakingMinutes - active));
}
