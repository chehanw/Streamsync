/**
 * Lab Value Extractor
 *
 * Extracts PSA, HbA1c, and urinalysis results from FHIR Observation
 * resources. Uses LOINC code matching first, then text-based fallback.
 */

import type { PrefillEntry, PrefillSource, LabValue, NormalizedObservation } from './types';
import { emptyEntry } from './types';
import { LOINC, LAB_TEXT_PATTERNS } from './codes';
import { parseObservationRecord } from './fhir-parser';

type ClinicalLabRecord = {
  displayName: string;
  fhirResource?: Record<string, unknown>;
};

function matchesCode(obs: NormalizedObservation, targetCode: string): boolean {
  if (!obs.code?.code) return false;
  return obs.code.code === targetCode;
}

function matchesTextPattern(name: string, patterns: readonly string[]): boolean {
  const lower = name.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

function observationToLabValue(obs: NormalizedObservation): LabValue | null {
  if (obs.value == null) return null;
  return {
    value: obs.value,
    unit: obs.unit ?? '',
    date: obs.effectiveDate ?? '',
    referenceRange: obs.referenceRange,
  };
}

function buildEntry(
  obs: NormalizedObservation,
  displayName: string,
  matchMethod: 'code' | 'text',
  matchedCode?: string,
): PrefillEntry<LabValue> {
  const labValue = observationToLabValue(obs);
  if (!labValue) return emptyEntry<LabValue>();

  const source: PrefillSource = {
    type: 'clinical_record',
    displayName,
    matchMethod,
    matchedCode,
  };

  return {
    value: labValue,
    confidence: matchMethod === 'code' ? 'high' : 'medium',
    sources: [source],
  };
}

export function extractPSA(records: ClinicalLabRecord[]): PrefillEntry<LabValue> {
  // Pass 1: LOINC code match
  for (const record of records) {
    const obs = parseObservationRecord(record.fhirResource, record.displayName);
    if (matchesCode(obs, LOINC.PSA)) {
      const entry = buildEntry(obs, record.displayName, 'code', `LOINC|${LOINC.PSA}`);
      if (entry.value) return entry;
    }
  }

  // Pass 2: text match
  for (const record of records) {
    if (matchesTextPattern(record.displayName, LAB_TEXT_PATTERNS.psa)) {
      const obs = parseObservationRecord(record.fhirResource, record.displayName);
      const entry = buildEntry(obs, record.displayName, 'text');
      if (entry.value) return entry;
    }
  }

  return emptyEntry<LabValue>();
}

export function extractHbA1c(records: ClinicalLabRecord[]): PrefillEntry<LabValue> {
  // Pass 1: LOINC code match
  for (const record of records) {
    const obs = parseObservationRecord(record.fhirResource, record.displayName);
    if (matchesCode(obs, LOINC.HBA1C)) {
      const entry = buildEntry(obs, record.displayName, 'code', `LOINC|${LOINC.HBA1C}`);
      if (entry.value) return entry;
    }
  }

  // Pass 2: text match
  for (const record of records) {
    if (matchesTextPattern(record.displayName, LAB_TEXT_PATTERNS.hba1c)) {
      const obs = parseObservationRecord(record.fhirResource, record.displayName);
      const entry = buildEntry(obs, record.displayName, 'text');
      if (entry.value) return entry;
    }
  }

  return emptyEntry<LabValue>();
}

export function extractUrinalysis(records: ClinicalLabRecord[]): PrefillEntry<LabValue> {
  // Pass 1: LOINC code match
  for (const record of records) {
    const obs = parseObservationRecord(record.fhirResource, record.displayName);
    if (matchesCode(obs, LOINC.URINALYSIS_PANEL)) {
      const entry = buildEntry(obs, record.displayName, 'code', `LOINC|${LOINC.URINALYSIS_PANEL}`);
      if (entry.value) return entry;
    }
  }

  // Pass 2: text match
  for (const record of records) {
    if (matchesTextPattern(record.displayName, LAB_TEXT_PATTERNS.urinalysis)) {
      const obs = parseObservationRecord(record.fhirResource, record.displayName);
      const entry = buildEntry(obs, record.displayName, 'text');
      if (entry.value) return entry;
    }
  }

  return emptyEntry<LabValue>();
}
