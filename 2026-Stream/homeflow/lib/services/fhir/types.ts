/**
 * FHIR Normalization Types
 *
 * Interfaces for medical history prefill data extracted from
 * Apple Health clinical records and HealthKit demographics.
 */

// ── Prefill Entry ───────────────────────────────────────────────────

export type Confidence = 'high' | 'medium' | 'low' | 'none';

export interface PrefillSource {
  type: string;
  displayName: string;
  matchMethod: 'code' | 'text' | 'direct_api';
  matchedCode?: string;
}

export interface PrefillEntry<T> {
  value: T | null;
  confidence: Confidence;
  sources: PrefillSource[];
}

/** Create an empty prefill entry (no data found) */
export function emptyEntry<T>(): PrefillEntry<T> {
  return { value: null, confidence: 'none', sources: [] };
}

// ── Medication Classification ───────────────────────────────────────

export type BPHDrugClass =
  | 'alpha_blocker'
  | 'five_ari'
  | 'anticholinergic'
  | 'beta3_agonist'
  | 'other_bph';

export interface ClassifiedMedication {
  name: string;
  genericName?: string;
  drugClass: BPHDrugClass | 'unrelated';
  source: PrefillSource;
}

// ── Lab Values ──────────────────────────────────────────────────────

export interface LabValue {
  value: number;
  unit: string;
  date: string;
  referenceRange?: string;
}

// ── Condition ───────────────────────────────────────────────────────

export type KnownCondition = 'diabetes' | 'hypertension' | 'bph' | 'other';

export interface MappedCondition {
  name: string;
  category: KnownCondition;
  source: PrefillSource;
}

// ── Procedure ───────────────────────────────────────────────────────

export interface MappedProcedure {
  name: string;
  date?: string;
  isBPH: boolean;
  source: PrefillSource;
}

// ── Demographics ────────────────────────────────────────────────────

export interface HealthKitDemographics {
  age: number | null;
  dateOfBirth: string | null;
  biologicalSex: string | null;
}

// ── Medical History Prefill (7 sections) ────────────────────────────

export interface MedicalHistoryPrefill {
  demographics: {
    age: PrefillEntry<number>;
    biologicalSex: PrefillEntry<string>;
    fullName: PrefillEntry<string>;
    ethnicity: PrefillEntry<string>;
    race: PrefillEntry<string>;
  };

  medications: {
    alphaBlockers: PrefillEntry<ClassifiedMedication[]>;
    fiveARIs: PrefillEntry<ClassifiedMedication[]>;
    anticholinergics: PrefillEntry<ClassifiedMedication[]>;
    beta3Agonists: PrefillEntry<ClassifiedMedication[]>;
    otherBPH: PrefillEntry<ClassifiedMedication[]>;
  };

  surgicalHistory: {
    bphProcedures: PrefillEntry<MappedProcedure[]>;
    otherProcedures: PrefillEntry<MappedProcedure[]>;
  };

  labs: {
    psa: PrefillEntry<LabValue>;
    hba1c: PrefillEntry<LabValue>;
    urinalysis: PrefillEntry<LabValue>;
  };

  conditions: {
    diabetes: PrefillEntry<MappedCondition[]>;
    hypertension: PrefillEntry<MappedCondition[]>;
    bph: PrefillEntry<MappedCondition[]>;
    other: PrefillEntry<MappedCondition[]>;
  };

  clinicalMeasurements: {
    pvr: PrefillEntry<LabValue>;
    uroflowQmax: PrefillEntry<LabValue>;
    volumeVoided: PrefillEntry<LabValue>;
    mobility: PrefillEntry<string>;
  };

  upcomingSurgery: {
    date: PrefillEntry<string>;
    type: PrefillEntry<string>;
  };
}

// ── Normalized FHIR Resource Types ──────────────────────────────────

export interface NormalizedMedication {
  resourceType: 'MedicationOrder' | 'MedicationRequest' | 'MedicationStatement';
  name: string;
  code?: { system?: string; code?: string; display?: string };
  status?: string;
  dateWritten?: string;
}

export interface NormalizedObservation {
  resourceType: 'Observation';
  code?: { system?: string; code?: string; display?: string };
  value?: number;
  unit?: string;
  valueString?: string;
  effectiveDate?: string;
  status?: string;
  referenceRange?: string;
}

export interface NormalizedCondition {
  resourceType: 'Condition';
  name: string;
  code?: { system?: string; code?: string; display?: string };
  clinicalStatus?: string;
  onsetDate?: string;
}

export interface NormalizedProcedure {
  resourceType: 'Procedure';
  name: string;
  code?: { system?: string; code?: string; display?: string };
  status?: string;
  performedDate?: string;
}

export type NormalizedResource =
  | NormalizedMedication
  | NormalizedObservation
  | NormalizedCondition
  | NormalizedProcedure;

// ── Clinical Records Input ──────────────────────────────────────────

export interface ClinicalRecordsInput {
  medications: Array<{ displayName: string; fhirResource?: Record<string, unknown> }>;
  labResults: Array<{ displayName: string; fhirResource?: Record<string, unknown> }>;
  conditions: Array<{ displayName: string; fhirResource?: Record<string, unknown> }>;
  procedures: Array<{ displayName: string; fhirResource?: Record<string, unknown> }>;
}
