/**
 * FHIR Normalization Service
 *
 * Parses Apple Health clinical records into structured medical history data,
 * classifies medications, maps conditions, and builds prefill data
 * for the medical history chatbot.
 */

// Types
export type {
  PrefillEntry,
  PrefillSource,
  Confidence,
  ClassifiedMedication,
  BPHDrugClass,
  LabValue,
  MappedCondition,
  KnownCondition,
  MappedProcedure,
  HealthKitDemographics,
  MedicalHistoryPrefill,
  ClinicalRecordsInput,
  NormalizedMedication,
  NormalizedObservation,
  NormalizedCondition,
  NormalizedProcedure,
  NormalizedResource,
} from './types';

export { emptyEntry } from './types';

// Parser
export { parseResource, parseFhirPayload } from './fhir-parser';

// Classifiers / Mappers
export { classifyMedications, groupByDrugClass } from './medication-classifier';
export { extractPSA, extractHbA1c, extractUrinalysis } from './lab-extractor';
export { mapConditions, groupByCategory } from './condition-mapper';
export { mapProcedures, separateProcedures } from './procedure-mapper';

// Orchestrator
export {
  buildMedicalHistoryPrefill,
  isFullyPrefilled,
  getMissingFields,
  getKnownFieldsSummary,
} from './prefill-builder';

// Prompt generation
export { buildModifiedSystemPrompt } from './prompt-modifier';
