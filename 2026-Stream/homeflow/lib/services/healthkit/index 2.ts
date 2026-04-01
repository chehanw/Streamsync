/**
 * HealthKit Service
 *
 * Clean abstraction for Apple HealthKit data queries.
 * Uses @kingstinct/react-native-healthkit under the hood.
 *
 * Usage:
 *   import { requestHealthPermissions, getDailyActivity, getSleep, getVitals } from '@/lib/services/healthkit';
 *
 * All data collection is gated behind explicit user consent via requestHealthPermissions().
 * No health data is logged in production. Data is normalized to simple units.
 */

export {
  requestHealthPermissions,
  getDailyActivity,
  getSleep,
  getVitals,
  getBiologicalSex,
  getDateOfBirth,
  getDemographics,
} from './HealthKitClient';

export { getDateRange } from './mappers';

export { SleepStage } from './types';

export type {
  DateRange,
  DailyActivity,
  SleepNight,
  SleepSample,
  VitalsDay,
  VitalsSample,
  HeartRateStats,
  HealthPermissionResult,
} from './types';

// ── Clinical Records (FHIR) ────────────────────────────────────────

export {
  areClinicalRecordsAvailable,
  requestClinicalPermissions,
  getClinicalMedications,
  getClinicalLabResults,
  getClinicalConditions,
  getClinicalProcedures,
  getClinicalNotes,
  getAllClinicalRecords,
} from './ClinicalRecordsClient';

export { ClinicalRecordType } from '@/modules/expo-clinical-records/src';

export type {
  ClinicalRecord,
  ClinicalRecordQueryOptions,
  ClinicalRecordsAuthResult,
} from '@/modules/expo-clinical-records/src';
