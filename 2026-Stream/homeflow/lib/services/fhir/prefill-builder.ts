/**
 * Prefill Builder
 *
 * Main orchestrator: takes clinical records + HealthKit demographics
 * and builds a complete MedicalHistoryPrefill with confidence scores.
 */

import type {
  MedicalHistoryPrefill,
  PrefillEntry,
  ClinicalRecordsInput,
  HealthKitDemographics,
  ClassifiedMedication,
  MappedCondition,
  MappedProcedure,
  LabValue,
  PrefillSource,
} from './types';
import { emptyEntry } from './types';
import { classifyMedications, groupByDrugClass } from './medication-classifier';
import { extractPSA, extractHbA1c, extractUrinalysis } from './lab-extractor';
import { mapConditions, groupByCategory } from './condition-mapper';
import { mapProcedures, separateProcedures } from './procedure-mapper';

// ── Demographics from HealthKit ─────────────────────────────────────

function buildDemographics(demographics: HealthKitDemographics | null) {
  const age: PrefillEntry<number> = demographics?.age != null
    ? {
        value: demographics.age,
        confidence: 'high',
        sources: [{
          type: 'healthkit',
          displayName: `Age: ${demographics.age}`,
          matchMethod: 'direct_api',
        }],
      }
    : emptyEntry<number>();

  const biologicalSex: PrefillEntry<string> = demographics?.biologicalSex
    ? {
        value: demographics.biologicalSex,
        confidence: 'high',
        sources: [{
          type: 'healthkit',
          displayName: `Sex: ${demographics.biologicalSex}`,
          matchMethod: 'direct_api',
        }],
      }
    : emptyEntry<string>();

  return {
    age,
    biologicalSex,
    fullName: emptyEntry<string>(),
    ethnicity: emptyEntry<string>(),
    race: emptyEntry<string>(),
  };
}

// ── Medication entries ──────────────────────────────────────────────

function buildMedicationEntry(
  meds: ClassifiedMedication[],
): PrefillEntry<ClassifiedMedication[]> {
  if (meds.length === 0) return emptyEntry<ClassifiedMedication[]>();

  const hasCodeMatch = meds.some((m) => m.source.matchMethod === 'code');
  return {
    value: meds,
    confidence: hasCodeMatch ? 'high' : 'medium',
    sources: meds.map((m) => m.source),
  };
}

// ── Condition entries ───────────────────────────────────────────────

function buildConditionEntry(
  conditions: MappedCondition[],
): PrefillEntry<MappedCondition[]> {
  if (conditions.length === 0) return emptyEntry<MappedCondition[]>();

  const hasCodeMatch = conditions.some((c) => c.source.matchMethod === 'code');
  return {
    value: conditions,
    confidence: hasCodeMatch ? 'high' : 'medium',
    sources: conditions.map((c) => c.source),
  };
}

// ── Procedure entries ───────────────────────────────────────────────

function buildProcedureEntry(
  procedures: MappedProcedure[],
): PrefillEntry<MappedProcedure[]> {
  if (procedures.length === 0) return emptyEntry<MappedProcedure[]>();

  const hasCodeMatch = procedures.some((p) => p.source.matchMethod === 'code');
  return {
    value: procedures,
    confidence: hasCodeMatch ? 'high' : 'medium',
    sources: procedures.map((p) => p.source),
  };
}

// ── Public API ──────────────────────────────────────────────────────

export function buildMedicalHistoryPrefill(
  clinicalRecords: ClinicalRecordsInput | null,
  demographics: HealthKitDemographics | null,
): MedicalHistoryPrefill {
  // Classify medications
  const allMeds = clinicalRecords
    ? classifyMedications(clinicalRecords.medications)
    : [];
  const medGroups = groupByDrugClass(allMeds);

  // Map conditions
  const allConditions = clinicalRecords
    ? mapConditions(clinicalRecords.conditions)
    : [];
  const condGroups = groupByCategory(allConditions);

  // Map procedures
  const allProcedures = clinicalRecords
    ? mapProcedures(clinicalRecords.procedures)
    : [];
  const procGroups = separateProcedures(allProcedures);

  // Extract labs
  const labRecords = clinicalRecords?.labResults ?? [];

  return {
    demographics: buildDemographics(demographics),

    medications: {
      alphaBlockers: buildMedicationEntry(medGroups.alphaBlockers),
      fiveARIs: buildMedicationEntry(medGroups.fiveARIs),
      anticholinergics: buildMedicationEntry(medGroups.anticholinergics),
      beta3Agonists: buildMedicationEntry(medGroups.beta3Agonists),
      otherBPH: buildMedicationEntry(medGroups.otherBPH),
    },

    surgicalHistory: {
      bphProcedures: buildProcedureEntry(procGroups.bphProcedures),
      otherProcedures: buildProcedureEntry(procGroups.otherProcedures),
    },

    labs: {
      psa: extractPSA(labRecords),
      hba1c: extractHbA1c(labRecords),
      urinalysis: extractUrinalysis(labRecords),
    },

    conditions: {
      diabetes: buildConditionEntry(condGroups.diabetes),
      hypertension: buildConditionEntry(condGroups.hypertension),
      bph: buildConditionEntry(condGroups.bph),
      other: buildConditionEntry(condGroups.other),
    },

    clinicalMeasurements: {
      pvr: emptyEntry<LabValue>(),
      uroflowQmax: emptyEntry<LabValue>(),
      volumeVoided: emptyEntry<LabValue>(),
      mobility: emptyEntry<string>(),
    },

    upcomingSurgery: {
      date: emptyEntry<string>(),
      type: emptyEntry<string>(),
    },
  };
}

/**
 * Check if all required fields are filled.
 * "Fully prefilled" means: demographics (age, sex), medications reviewed,
 * conditions reviewed, surgical history reviewed, and labs reviewed.
 *
 * Fields that are always `none` (fullName, ethnicity, race, upcoming surgery)
 * are excluded from this check since they must always be asked.
 */
export function isFullyPrefilled(prefill: MedicalHistoryPrefill): boolean {
  // Demographics: age and biologicalSex must be known
  if (prefill.demographics.age.confidence === 'none') return false;
  if (prefill.demographics.biologicalSex.confidence === 'none') return false;

  // We always need to ask: fullName, ethnicity, race, upcoming surgery, clinical measurements
  // So "fully prefilled" is never truly possible when those fields matter.
  // Instead, we check if the *medical data* sections are covered.

  // At least one medication category must have been checked (records exist)
  const hasMedData = [
    prefill.medications.alphaBlockers,
    prefill.medications.fiveARIs,
    prefill.medications.anticholinergics,
    prefill.medications.beta3Agonists,
    prefill.medications.otherBPH,
  ].some((entry) => entry.confidence !== 'none');

  // Conditions must have been checked
  const hasConditionData = [
    prefill.conditions.diabetes,
    prefill.conditions.hypertension,
    prefill.conditions.bph,
    prefill.conditions.other,
  ].some((entry) => entry.confidence !== 'none');

  return hasMedData && hasConditionData;
}

/**
 * Get a list of fields that still need to be asked about.
 */
export function getMissingFields(prefill: MedicalHistoryPrefill): string[] {
  const missing: string[] = [];

  // Always need to ask these
  missing.push('fullName', 'ethnicity', 'race');

  // Demographics
  if (prefill.demographics.age.confidence === 'none') missing.push('age');
  if (prefill.demographics.biologicalSex.confidence === 'none') missing.push('biologicalSex');

  // Medications - if none found, we need to ask
  const noMedData = [
    prefill.medications.alphaBlockers,
    prefill.medications.fiveARIs,
    prefill.medications.anticholinergics,
    prefill.medications.beta3Agonists,
    prefill.medications.otherBPH,
  ].every((entry) => entry.confidence === 'none');
  if (noMedData) missing.push('medications');

  // Surgical history
  if (prefill.surgicalHistory.bphProcedures.confidence === 'none' &&
      prefill.surgicalHistory.otherProcedures.confidence === 'none') {
    missing.push('surgicalHistory');
  }

  // Labs
  if (prefill.labs.psa.confidence === 'none') missing.push('psa');
  if (prefill.labs.hba1c.confidence === 'none') missing.push('hba1c');
  if (prefill.labs.urinalysis.confidence === 'none') missing.push('urinalysis');

  // Conditions
  const noCondData = [
    prefill.conditions.diabetes,
    prefill.conditions.hypertension,
    prefill.conditions.bph,
    prefill.conditions.other,
  ].every((entry) => entry.confidence === 'none');
  if (noCondData) missing.push('conditions');

  // Clinical measurements (always need to ask)
  missing.push('clinicalMeasurements');

  // Upcoming surgery (always need to ask)
  missing.push('upcomingSurgery');

  return missing;
}

/**
 * Get a human-readable summary of known fields.
 */
export function getKnownFieldsSummary(prefill: MedicalHistoryPrefill): string[] {
  const known: string[] = [];

  if (prefill.demographics.age.value != null) {
    known.push(`Age: ${prefill.demographics.age.value}`);
  }
  if (prefill.demographics.biologicalSex.value) {
    known.push(`Biological sex: ${prefill.demographics.biologicalSex.value}`);
  }

  // Medications
  const medCategories = [
    { label: 'Alpha blockers', entry: prefill.medications.alphaBlockers },
    { label: '5-ARIs', entry: prefill.medications.fiveARIs },
    { label: 'Anticholinergics', entry: prefill.medications.anticholinergics },
    { label: 'Beta-3 agonists', entry: prefill.medications.beta3Agonists },
    { label: 'Other BPH meds', entry: prefill.medications.otherBPH },
  ];
  for (const { label, entry } of medCategories) {
    if (entry.value && entry.value.length > 0) {
      const names = entry.value.map((m) => m.name).join(', ');
      known.push(`${label}: ${names}`);
    }
  }

  // Conditions
  const condCategories = [
    { label: 'Diabetes', entry: prefill.conditions.diabetes },
    { label: 'Hypertension', entry: prefill.conditions.hypertension },
    { label: 'BPH', entry: prefill.conditions.bph },
  ];
  for (const { label, entry } of condCategories) {
    if (entry.value && entry.value.length > 0) {
      known.push(`${label}: Yes (from health records)`);
    }
  }

  // Labs
  if (prefill.labs.psa.value) {
    known.push(`PSA: ${prefill.labs.psa.value.value} ${prefill.labs.psa.value.unit}`);
  }
  if (prefill.labs.hba1c.value) {
    known.push(`HbA1c: ${prefill.labs.hba1c.value.value}${prefill.labs.hba1c.value.unit}`);
  }

  // Procedures
  if (prefill.surgicalHistory.bphProcedures.value?.length) {
    const names = prefill.surgicalHistory.bphProcedures.value.map((p) => p.name).join(', ');
    known.push(`BPH procedures: ${names}`);
  }
  if (prefill.surgicalHistory.otherProcedures.value?.length) {
    known.push(`Other surgeries: ${prefill.surgicalHistory.otherProcedures.value.length} found`);
  }

  return known;
}
