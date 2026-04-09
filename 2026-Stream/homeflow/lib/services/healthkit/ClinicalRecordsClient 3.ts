import type { ClinicalRecord } from '@/modules/expo-clinical-records/src';
import type { DateRange, HealthPermissionResult } from './types';

export function areClinicalRecordsAvailable(): boolean {
  return false;
}

export async function requestClinicalPermissions(): Promise<HealthPermissionResult> {
  return {
    success: false,
    note: 'Clinical records are temporarily disabled for crash isolation.',
  };
}

export async function getClinicalMedications(
  _range?: DateRange,
): Promise<ClinicalRecord[]> {
  return [];
}

export async function getClinicalLabResults(
  _range?: DateRange,
): Promise<ClinicalRecord[]> {
  return [];
}

export async function getClinicalConditions(
  _range?: DateRange,
): Promise<ClinicalRecord[]> {
  return [];
}

export async function getClinicalProcedures(
  _range?: DateRange,
): Promise<ClinicalRecord[]> {
  return [];
}

export async function getClinicalNotes(
  _range?: DateRange,
): Promise<ClinicalRecord[]> {
  return [];
}

export async function getAllClinicalRecords(
  _range?: DateRange,
): Promise<{
  medications: ClinicalRecord[];
  labResults: ClinicalRecord[];
  conditions: ClinicalRecord[];
  procedures: ClinicalRecord[];
}> {
  return {
    medications: [],
    labResults: [],
    conditions: [],
    procedures: [],
  };
}
