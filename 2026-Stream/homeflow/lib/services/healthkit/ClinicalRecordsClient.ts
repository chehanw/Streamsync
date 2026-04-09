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
  getClinicalDocumentSamples,
  ClinicalRecordType,
} from '@/modules/expo-clinical-records/src';
import type {
  ClinicalRecord,
  ClinicalDocumentSample,
  ClinicalRecordsAuthResult,
  ClinicalNoteAccessProbeResult,
} from '@/modules/expo-clinical-records/src';
import type { DateRange, HealthPermissionResult } from './types';

export function areClinicalRecordsAvailable(): boolean {
  return isClinicalRecordsAvailable();
}

export async function requestClinicalPermissions(): Promise<HealthPermissionResult> {
  const result: ClinicalRecordsAuthResult = await requestClinicalRecordsAuthorization();
  return {
    success: result.success,
    note: result.note,
  };
}

export async function getClinicalMedications(
  range?: DateRange,
): Promise<ClinicalRecord[]> {
  return getClinicalRecords(
    ClinicalRecordType.MedicationRecord,
    buildOptions(range),
  );
}

export async function getClinicalLabResults(
  range?: DateRange,
): Promise<ClinicalRecord[]> {
  return getClinicalRecords(
    ClinicalRecordType.LabResultRecord,
    buildOptions(range),
  );
}

export async function getClinicalConditions(
  range?: DateRange,
): Promise<ClinicalRecord[]> {
  return getClinicalRecords(
    ClinicalRecordType.ConditionRecord,
    buildOptions(range),
  );
}

export async function getClinicalProcedures(
  range?: DateRange,
): Promise<ClinicalRecord[]> {
  return getClinicalRecords(
    ClinicalRecordType.ProcedureRecord,
    buildOptions(range),
  );
}

export async function getClinicalNotes(
  range?: DateRange,
): Promise<ClinicalRecord[]> {
  return getClinicalRecords(
    ClinicalRecordType.ClinicalNoteRecord,
    buildOptions(range),
  );
}

export async function getHealthKitDocumentSamples(
  range?: DateRange,
): Promise<ClinicalDocumentSample[]> {
  return getClinicalDocumentSamples(buildOptions(range));
}

export async function probeClinicalNoteAccess(
  range?: DateRange,
): Promise<ClinicalNoteAccessProbeResult> {
  const [notes, documentSamples] = await Promise.all([
    getClinicalNotes(range),
    getHealthKitDocumentSamples(range),
  ]);

  let notesWithInlineAttachmentData = 0;
  let notesWithAttachmentUrlOnly = 0;
  let notesWithoutAttachment = 0;

  for (const note of notes) {
    const content = note.fhirResource?.content as
      | { attachment?: Record<string, unknown> }[]
      | undefined;
    const attachment = Array.isArray(content) ? content[0]?.attachment : undefined;
    const inlineData = attachment?.data;
    const attachmentUrl = attachment?.url;

    if (typeof inlineData === 'string' && inlineData.length > 0) {
      notesWithInlineAttachmentData++;
    } else if (typeof attachmentUrl === 'string' && attachmentUrl.length > 0) {
      notesWithAttachmentUrlOnly++;
    } else {
      notesWithoutAttachment++;
    }
  }

  let documentSamplesWithData = 0;
  for (const sample of documentSamples) {
    if (typeof sample.documentData === 'string' && sample.documentData.length > 0) {
      documentSamplesWithData++;
    }
  }

  return {
    clinicalNoteCount: notes.length,
    notesWithInlineAttachmentData,
    notesWithAttachmentUrlOnly,
    notesWithoutAttachment,
    documentSampleCount: documentSamples.length,
    documentSamplesWithData,
  };
}

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

function buildOptions(range?: DateRange) {
  if (!range) return undefined;
  return {
    startDate: range.startDate.toISOString(),
    endDate: range.endDate.toISOString(),
  };
}
