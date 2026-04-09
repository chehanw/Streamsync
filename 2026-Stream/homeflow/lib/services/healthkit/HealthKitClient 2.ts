/**
 * HealthKit Client
 *
 * Clean abstraction over @kingstinct/react-native-healthkit.
 * Exposes functions for permissions, activity, sleep, and vitals queries.
 * iOS only — all functions return empty/default data on non-iOS platforms.
 */

import { Platform } from 'react-native';
import {
  requestAuthorization,
  queryQuantitySamples,
  queryCategorySamples,
  isHealthDataAvailable,
  getBiologicalSex as hkGetBiologicalSex,
  getDateOfBirth as hkGetDateOfBirth,
  BiologicalSex,
} from '@kingstinct/react-native-healthkit';
import type { QuantitySample } from '@kingstinct/react-native-healthkit';
import type { HealthKitDemographics } from '../fhir/types';

import {
  formatDateKey,
  getDateKeysInRange,
  bucketSamplesByDay,
  sumSamples,
  statsSamples,
  mapCategorySampleToSleepSample,
  getSleepNightDate,
  estimateSedentaryMinutes,
} from './mappers';

import {
  SleepStage,
  type DateRange,
  type DailyActivity,
  type SleepNight,
  type VitalsDay,
  type HealthPermissionResult,
} from './types';

// ── HK Type Identifiers ────────────────────────────────────────────
// Using the full Apple string identifiers as required by the library.

const HK = {
  // Activity
  stepCount: 'HKQuantityTypeIdentifierStepCount' as const,
  activeEnergy: 'HKQuantityTypeIdentifierActiveEnergyBurned' as const,
  exerciseTime: 'HKQuantityTypeIdentifierAppleExerciseTime' as const,
  moveTime: 'HKQuantityTypeIdentifierAppleMoveTime' as const,
  standTime: 'HKQuantityTypeIdentifierAppleStandTime' as const,
  distance: 'HKQuantityTypeIdentifierDistanceWalkingRunning' as const,

  // Sleep (category type)
  sleepAnalysis: 'HKCategoryTypeIdentifierSleepAnalysis' as const,

  // Vitals
  heartRate: 'HKQuantityTypeIdentifierHeartRate' as const,
  restingHeartRate: 'HKQuantityTypeIdentifierRestingHeartRate' as const,
  hrv: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN' as const,
  respiratoryRate: 'HKQuantityTypeIdentifierRespiratoryRate' as const,
  oxygenSaturation: 'HKQuantityTypeIdentifierOxygenSaturation' as const,

  // Body (read-only context)
  bodyMass: 'HKQuantityTypeIdentifierBodyMass' as const,
  height: 'HKQuantityTypeIdentifierHeight' as const,
};

/** All types we request read access for */
const ALL_READ_TYPES = [
  HK.stepCount,
  HK.activeEnergy,
  HK.exerciseTime,
  HK.moveTime,
  HK.standTime,
  HK.distance,
  HK.sleepAnalysis,
  HK.heartRate,
  HK.restingHeartRate,
  HK.hrv,
  HK.respiratoryRate,
  HK.oxygenSaturation,
  HK.bodyMass,
  HK.height,
];

/** Types we request write access for (subset) */
const WRITE_TYPES = [
  HK.stepCount,
  HK.activeEnergy,
  HK.sleepAnalysis,
  HK.heartRate,
];

// ── Platform guard ──────────────────────────────────────────────────

function isIOS(): boolean {
  return Platform.OS === 'ios';
}

// ── Query helper ────────────────────────────────────────────────────

async function queryQuantity(
  identifier: string,
  range: DateRange,
  unit: string,
): Promise<readonly QuantitySample[]> {
  return queryQuantitySamples(identifier as any, {
    limit: 0, // 0 = no limit, fetch all samples in range
    unit,
    filter: {
      date: {
        startDate: range.startDate,
        endDate: range.endDate,
      },
    },
  });
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Request HealthKit permissions for all data types used by the app.
 * Must be called before any data queries.
 *
 * Privacy note: HealthKit always returns "not determined" for read
 * permissions regardless of whether the user granted them. This is
 * an Apple privacy design — the only way to know if read was granted
 * is to attempt a query and see if data comes back.
 */
export async function requestHealthPermissions(): Promise<HealthPermissionResult> {
  if (!isIOS()) {
    return {
      success: false,
      note: 'HealthKit is only available on iOS.',
    };
  }

  try {
    const available = isHealthDataAvailable();
    if (!available) {
      return {
        success: false,
        note: 'HealthKit is not available on this device.',
      };
    }

    await requestAuthorization({
      toRead: ALL_READ_TYPES as any,
      toShare: WRITE_TYPES as any,
    });

    return {
      success: true,
      note: 'Authorization requested. Read permission status is always "not determined" for privacy — this is expected Apple behavior.',
    };
  } catch (error) {
    return {
      success: false,
      note: `Permission request failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Get daily activity summaries for a date range.
 * Returns one DailyActivity per day.
 */
export async function getDailyActivity(range: DateRange): Promise<DailyActivity[]> {
  if (!isIOS()) return [];

  // Fetch all activity types in parallel; catch individually so Watch-only
  // type failures (exerciseTime, moveTime, standTime) don't block step/energy data
  const [steps, energy, exercise, move, stand, distance] = await Promise.all([
    queryQuantity(HK.stepCount, range, 'count').catch(() => [] as readonly QuantitySample[]),
    queryQuantity(HK.activeEnergy, range, 'kcal').catch(() => [] as readonly QuantitySample[]),
    queryQuantity(HK.exerciseTime, range, 'min').catch(() => [] as readonly QuantitySample[]),
    queryQuantity(HK.moveTime, range, 'min').catch(() => [] as readonly QuantitySample[]),
    queryQuantity(HK.standTime, range, 'min').catch(() => [] as readonly QuantitySample[]),
    queryQuantity(HK.distance, range, 'm').catch(() => [] as readonly QuantitySample[]),
  ]);

  // Bucket each metric by day
  const stepsByDay = bucketSamplesByDay(steps);
  const energyByDay = bucketSamplesByDay(energy);
  const exerciseByDay = bucketSamplesByDay(exercise);
  const moveByDay = bucketSamplesByDay(move);
  const standByDay = bucketSamplesByDay(stand);
  const distanceByDay = bucketSamplesByDay(distance);

  // Build daily summaries
  const dateKeys = getDateKeysInRange(range.startDate, range.endDate);
  return dateKeys.map((date) => {
    const exerciseMin = Math.round(sumSamples(exerciseByDay.get(date) ?? []));
    const moveMin = Math.round(sumSamples(moveByDay.get(date) ?? []));
    const standMin = Math.round(sumSamples(standByDay.get(date) ?? []));

    return {
      date,
      steps: Math.round(sumSamples(stepsByDay.get(date) ?? [])),
      exerciseMinutes: exerciseMin,
      moveMinutes: moveMin,
      standMinutes: standMin,
      sedentaryMinutes: estimateSedentaryMinutes(exerciseMin, moveMin, standMin),
      activeEnergyBurned: Math.round(sumSamples(energyByDay.get(date) ?? [])),
      distanceWalkingRunning: Math.round(sumSamples(distanceByDay.get(date) ?? [])),
    };
  });
}

/**
 * Get sleep data for a date range.
 * Groups sleep samples into nights with stage breakdowns.
 * On iOS 16+, provides detailed Core/Deep/REM stages.
 * On older iOS, falls back to "asleep" vs "in bed".
 */
export async function getSleep(range: DateRange): Promise<SleepNight[]> {
  if (!isIOS()) return [];

  const rawSamples = await queryCategorySamples(HK.sleepAnalysis, {
    limit: 0,
    filter: {
      date: {
        startDate: range.startDate,
        endDate: range.endDate,
      },
    },
  });

  if (!rawSamples || rawSamples.length === 0) return [];

  // Convert to our SleepSample type and group by night
  const nightMap = new Map<string, ReturnType<typeof mapCategorySampleToSleepSample>[]>();

  for (const raw of rawSamples) {
    const sample = mapCategorySampleToSleepSample(raw as any);
    const nightKey = getSleepNightDate(new Date(raw.startDate));
    const bucket = nightMap.get(nightKey) ?? [];
    bucket.push(sample);
    nightMap.set(nightKey, bucket);
  }

  // Aggregate each night
  const nights: SleepNight[] = [];
  for (const [date, samples] of nightMap) {
    let inBedMinutes = 0;
    let awakeMinutes = 0;
    let coreMinutes = 0;
    let deepMinutes = 0;
    let remMinutes = 0;
    let asleepUndifferentiated = 0;

    for (const s of samples) {
      switch (s.stage) {
        case SleepStage.InBed:
          inBedMinutes += s.durationMinutes;
          break;
        case SleepStage.Awake:
          awakeMinutes += s.durationMinutes;
          break;
        case SleepStage.Core:
          coreMinutes += s.durationMinutes;
          break;
        case SleepStage.Deep:
          deepMinutes += s.durationMinutes;
          break;
        case SleepStage.REM:
          remMinutes += s.durationMinutes;
          break;
        case SleepStage.AsleepUnspecified:
          asleepUndifferentiated += s.durationMinutes;
          break;
      }
    }

    const hasDetailedStages = coreMinutes > 0 || deepMinutes > 0 || remMinutes > 0;
    const totalAsleep = hasDetailedStages
      ? coreMinutes + deepMinutes + remMinutes
      : asleepUndifferentiated;
    const totalInBed = inBedMinutes > 0
      ? inBedMinutes
      : totalAsleep + awakeMinutes; // fallback if no explicit inBed samples

    const efficiency = totalInBed > 0
      ? Math.round((totalAsleep / totalInBed) * 1000) / 10
      : 0;

    nights.push({
      date,
      totalAsleepMinutes: Math.round(totalAsleep),
      totalInBedMinutes: Math.round(totalInBed),
      sleepEfficiency: efficiency,
      hasDetailedStages,
      stages: {
        awake: Math.round(awakeMinutes),
        core: Math.round(coreMinutes),
        deep: Math.round(deepMinutes),
        rem: Math.round(remMinutes),
        asleepUndifferentiated: Math.round(asleepUndifferentiated),
      },
      samples,
    });
  }

  // Sort by date
  nights.sort((a, b) => a.date.localeCompare(b.date));
  return nights;
}

/**
 * Get vitals data for a date range.
 * Includes heart rate (min/avg/max), resting HR, HRV, respiratory rate, SpO2.
 */
export async function getVitals(range: DateRange): Promise<VitalsDay[]> {
  if (!isIOS()) return [];

  // Fetch all vitals in parallel; catch individually so one missing type
  // doesn't block the rest
  const [hr, restingHR, hrvSamples, respRate, spo2] = await Promise.all([
    queryQuantity(HK.heartRate, range, 'count/min').catch(() => [] as readonly QuantitySample[]),
    queryQuantity(HK.restingHeartRate, range, 'count/min').catch(() => [] as readonly QuantitySample[]),
    queryQuantity(HK.hrv, range, 'ms').catch(() => [] as readonly QuantitySample[]),
    queryQuantity(HK.respiratoryRate, range, 'count/min').catch(() => [] as readonly QuantitySample[]),
    queryQuantity(HK.oxygenSaturation, range, '%').catch(() => [] as readonly QuantitySample[]),
  ]);

  // Bucket by day
  const hrByDay = bucketSamplesByDay(hr);
  const restingByDay = bucketSamplesByDay(restingHR);
  const hrvByDay = bucketSamplesByDay(hrvSamples);
  const respByDay = bucketSamplesByDay(respRate);
  const spo2ByDay = bucketSamplesByDay(spo2);

  const dateKeys = getDateKeysInRange(range.startDate, range.endDate);
  return dateKeys.map((date) => {
    const hrDaySamples = hrByDay.get(date) ?? [];
    const restingSamples = restingByDay.get(date) ?? [];
    const hrvDaySamples = hrvByDay.get(date) ?? [];
    const respSamples = respByDay.get(date) ?? [];
    const spo2Samples = spo2ByDay.get(date) ?? [];

    return {
      date,
      heartRate: statsSamples(hrDaySamples),
      restingHeartRate: restingSamples.length > 0
        ? Math.round(restingSamples[restingSamples.length - 1].quantity * 10) / 10
        : null,
      hrv: hrvDaySamples.length > 0
        ? Math.round(hrvDaySamples[hrvDaySamples.length - 1].quantity * 10) / 10
        : null,
      respiratoryRate: respSamples.length > 0
        ? Math.round(respSamples[respSamples.length - 1].quantity * 10) / 10
        : null,
      oxygenSaturation: spo2Samples.length > 0
        ? Math.round(spo2Samples[spo2Samples.length - 1].quantity * 100 * 10) / 10
        : null,
    };
  });
}

// ── Demographics ────────────────────────────────────────────────────

const BIOLOGICAL_SEX_LABELS: Record<BiologicalSex, string | null> = {
  [BiologicalSex.notSet]: null,
  [BiologicalSex.female]: 'Female',
  [BiologicalSex.male]: 'Male',
  [BiologicalSex.other]: 'Other',
};

/**
 * Get the user's biological sex from HealthKit.
 * Returns null if not set or unavailable.
 */
export async function getBiologicalSex(): Promise<string | null> {
  if (!isIOS()) return null;
  try {
    const sex = await hkGetBiologicalSex();
    return BIOLOGICAL_SEX_LABELS[sex] ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the user's date of birth from HealthKit.
 * Returns ISO date string or null if not set.
 */
export async function getDateOfBirth(): Promise<string | null> {
  if (!isIOS()) return null;
  try {
    const dob = await hkGetDateOfBirth();
    if (!dob || dob.getTime() === 0) return null;
    return dob.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

/**
 * Get demographics (age + biological sex) from HealthKit.
 * Combines getDateOfBirth and getBiologicalSex into a single call.
 */
export async function getDemographics(): Promise<HealthKitDemographics> {
  const [dob, sex] = await Promise.all([getDateOfBirth(), getBiologicalSex()]);

  let age: number | null = null;
  if (dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
  }

  return {
    age,
    dateOfBirth: dob,
    biologicalSex: sex,
  };
}
