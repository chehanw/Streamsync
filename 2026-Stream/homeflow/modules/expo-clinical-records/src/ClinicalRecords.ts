/**
 * Clinical Records API
 *
 * Platform-guarded public API for Apple Health Clinical Records.
 * Returns empty/default values on non-iOS platforms or when the
 * native module is not available.
 */

import { Platform } from 'react-native';
import ExpoClinicalRecords from './ExpoClinicalRecords';
import type {
  ClinicalRecord,
  ClinicalRecordQueryOptions,
  ClinicalRecordsAuthResult,
} from './ClinicalRecords.types';
import { ClinicalRecordType } from './ClinicalRecords.types';

/**
 * Check if clinical records are available on this device.
 * Returns false on non-iOS, simulators without Health Records, or
 * when the native module isn't compiled.
 */
export function isClinicalRecordsAvailable(): boolean {
  if (Platform.OS !== 'ios' || !ExpoClinicalRecords) {
    return false;
  }
  try {
    return ExpoClinicalRecords.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Request authorization to read clinical record types.
 * The user will see the standard HealthKit authorization sheet.
 *
 * Privacy note: HealthKit always returns "not determined" for read
 * permissions — this is expected Apple behavior.
 */
export async function requestClinicalRecordsAuthorization(
  types: ClinicalRecordType[] = Object.values(ClinicalRecordType),
): Promise<ClinicalRecordsAuthResult> {
  if (Platform.OS !== 'ios' || !ExpoClinicalRecords) {
    return { success: false, note: 'Clinical records are only available on iOS.' };
  }
  try {
    return await ExpoClinicalRecords.requestAuthorization(types);
  } catch (error) {
    return {
      success: false,
      note: `Authorization failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Query clinical records of a specific type.
 * Returns an empty array if not available or on error.
 */
export async function getClinicalRecords(
  type: ClinicalRecordType,
  options?: ClinicalRecordQueryOptions,
): Promise<ClinicalRecord[]> {
  if (Platform.OS !== 'ios' || !ExpoClinicalRecords) {
    return [];
  }
  try {
    return await ExpoClinicalRecords.getClinicalRecords(type, options ?? null);
  } catch {
    return [];
  }
}

/**
 * Get the list of supported clinical record type identifiers.
 */
export function getSupportedTypes(): string[] {
  if (Platform.OS !== 'ios' || !ExpoClinicalRecords) {
    return [];
  }
  try {
    return ExpoClinicalRecords.getSupportedTypes();
  } catch {
    return [];
  }
}
