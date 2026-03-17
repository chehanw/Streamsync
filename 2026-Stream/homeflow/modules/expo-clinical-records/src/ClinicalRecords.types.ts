/**
 * Clinical Records Types
 *
 * Types for Apple Health Clinical Records (FHIR R4).
 * These map to HKClinicalTypeIdentifier values in HealthKit.
 */

/** Supported HKClinicalRecord type identifiers */
export enum ClinicalRecordType {
  AllergyRecord = 'allergyRecord',
  ClinicalNoteRecord = 'clinicalNoteRecord',
  ConditionRecord = 'conditionRecord',
  ImmunizationRecord = 'immunizationRecord',
  LabResultRecord = 'labResultRecord',
  MedicationRecord = 'medicationRecord',
  ProcedureRecord = 'procedureRecord',
  VitalSignRecord = 'vitalSignRecord',
}

/** A single clinical record returned from HealthKit */
export interface ClinicalRecord {
  /** UUID of the HKClinicalRecord */
  id: string;
  /** The HKClinicalType identifier (e.g. "HKClinicalTypeIdentifierMedicationRecord") */
  clinicalType: string;
  /** Human-readable name from the health record */
  displayName: string;
  /** ISO 8601 start date */
  startDate: string;
  /** ISO 8601 end date */
  endDate: string;
  /** FHIR resource type (e.g. "MedicationOrder", "Condition") */
  fhirResourceType?: string;
  /** FHIR resource identifier */
  fhirIdentifier?: string;
  /** Source URL of the FHIR resource */
  fhirSourceURL?: string;
  /** The raw FHIR R4 JSON resource */
  fhirResource?: Record<string, unknown>;
}

/** Options for querying clinical records */
export interface ClinicalRecordQueryOptions {
  /** ISO 8601 start date filter */
  startDate?: string;
  /** ISO 8601 end date filter */
  endDate?: string;
  /** Maximum number of records to return (0 = no limit) */
  limit?: number;
}

/** Result of a clinical records authorization request */
export interface ClinicalRecordsAuthResult {
  success: boolean;
  note: string;
}
