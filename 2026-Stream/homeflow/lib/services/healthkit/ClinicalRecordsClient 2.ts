/**
 * Clinical Records Client
 *
 * App-level convenience functions for Apple Health Clinical Records.
 * Wraps the expo-clinical-records module with typed helpers for
 * medications, lab results, conditions, and procedures.
 *
 * iOS only — all functions return empty/default data on non-iOS platforms.
 */

import {
  isClinicalRecordsAvailable,
  requestClinicalRecordsAuthorization,
  getClinicalRecords,
  ClinicalRecordType,
} from '@/modules/expo-clinical-records/src';
import type {
  ClinicalRecord,
  ClinicalRecordsAuthResult,
} from '@/modules/expo-clinical-records/src';
import type { DateRange, HealthPermissionResult } from './types';

// ── Public API ──────────────────────────────────────────────────────

/**
 * Check if clinical records (FHIR) are available on this device.
 * Returns false on non-iOS, simulators, or devices without Health Records support.
 */
export function areClinicalRecordsAvailable(): boolean {
  return isClinicalRecordsAvailable();
}

/**
 * Request permission to read clinical records.
 * Prompts the standard HealthKit authorization sheet for clinical data.
 */
export async function requestClinicalPermissions(): Promise<HealthPermissionResult> {
  const result: ClinicalRecordsAuthResult = await requestClinicalRecordsAuthorization();
  return {
    success: result.success,
    note: result.note,
  };
}

/**
 * Get medication records from Apple Health.
 */
export async function getClinicalMedications(
  range?: DateRange,
): Promise<ClinicalRecord[]> {
  return getClinicalRecords(
    ClinicalRecordType.MedicationRecord,
    buildOptions(range),
  );
}

/**
 * Get lab result records from Apple Health.
 */
export async function getClinicalLabResults(
  range?: DateRange,
): Promise<ClinicalRecord[]> {
  return getClinicalRecords(
    ClinicalRecordType.LabResultRecord,
    buildOptions(range),
  );
}

/**
 * Get condition records from Apple Health.
 */
export async function getClinicalConditions(
  range?: DateRange,
): Promise<ClinicalRecord[]> {
  return getClinicalRecords(
    ClinicalRecordType.ConditionRecord,
    buildOptions(range),
  );
}

/**
 * Get procedure records from Apple Health.
 */
export async function getClinicalProcedures(
  range?: DateRange,
): Promise<ClinicalRecord[]> {
  return getClinicalRecords(
    ClinicalRecordType.ProcedureRecord,
    buildOptions(range),
  );
}

/**
 * Get clinical note documents from Apple Health.
 * Notes are FHIR DocumentReference resources; the document itself
 * (typically a PDF) is base64-encoded in fhirResource.content[].attachment.data.
 */
export async function getClinicalNotes(
  range?: DateRange,
): Promise<ClinicalRecord[]> {
  return getClinicalRecords(
    ClinicalRecordType.ClinicalNoteRecord,
    buildOptions(range),
  );
}

/**
 * Fetch all supported clinical record types at once.
 * Runs queries in parallel for efficiency.
 */
export async function getAllClinicalRecords(range?: DateRange): Promise<{
  medications: ClinicalRecord[];
  labResults: ClinicalRecord[];
  conditions: ClinicalRecord[];
  procedures: ClinicalRecord[];
}> {
  const [medications, labResults, conditions, procedures] = await Promise.all([
    getClinicalMedications(range),
    getClinicalLabResults(range),
    getClinicalConditions(range),
    getClinicalProcedures(range),
  ]);

  return { medications, labResults, conditions, procedures };
}

// ── Helpers ─────────────────────────────────────────────────────────

function buildOptions(range?: DateRange) {
  if (!range) return undefined;
  return {
    startDate: range.startDate.toISOString(),
    endDate: range.endDate.toISOString(),
  };
}
