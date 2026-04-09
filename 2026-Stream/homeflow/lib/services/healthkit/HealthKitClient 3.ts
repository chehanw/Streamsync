import type { HealthKitDemographics } from '../fhir/types';
import {
  type DateRange,
  type DailyActivity,
  type SleepNight,
  type VitalsDay,
  type HealthPermissionResult,
} from './types';

const HEALTHKIT_DISABLED_NOTE = 'HealthKit is temporarily disabled for crash isolation.';

export async function requestHealthPermissions(): Promise<HealthPermissionResult> {
  return {
    success: false,
    note: HEALTHKIT_DISABLED_NOTE,
  };
}

export async function getDailyActivity(_range: DateRange): Promise<DailyActivity[]> {
  return [];
}

export async function getSleep(_range: DateRange): Promise<SleepNight[]> {
  return [];
}

export async function getVitals(_range: DateRange): Promise<VitalsDay[]> {
  return [];
}

export async function getBiologicalSex(): Promise<'male' | 'female' | 'other' | null> {
  return null;
}

export async function getDateOfBirth(): Promise<Date | null> {
  return null;
}

export async function getDemographics(): Promise<HealthKitDemographics> {
  return {
    age: null,
    dateOfBirth: null,
    biologicalSex: null,
  };
}
