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

/** A single CDA document sample returned from HealthKit document queries */
export interface ClinicalDocumentSample {
  /** UUID of the HKCDADocumentSample */
  id: string;
  /** The HKDocumentType identifier (for now, always CDA) */
  documentType: string;
  /** ISO 8601 start date */
  startDate: string;
  /** ISO 8601 end date */
  endDate: string;
  /** Title extracted by HealthKit from the CDA payload */
  title?: string | null;
  /** Patient name extracted by HealthKit from the CDA payload */
  patientName?: string | null;
  /** Author extracted by HealthKit from the CDA payload */
  authorName?: string | null;
  /** Custodian extracted by HealthKit from the CDA payload */
  custodianName?: string | null;
  /** Base64-encoded CDA XML when includeDocumentData is true */
  documentData?: string | null;
}

/** Result of a clinical records authorization request */
export interface ClinicalRecordsAuthResult {
  success: boolean;
  note: string;
}

export interface ClinicalNoteAccessProbeResult {
  clinicalNoteCount: number;
  notesWithInlineAttachmentData: number;
  notesWithAttachmentUrlOnly: number;
  notesWithoutAttachment: number;
  documentSampleCount: number;
  documentSamplesWithData: number;
}
