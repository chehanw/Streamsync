export {
  isClinicalRecordsAvailable,
  requestClinicalRecordsAuthorization,
  getClinicalRecords,
  getClinicalDocumentSamples,
  getSupportedTypes,
} from './ClinicalRecords';

export { ClinicalRecordType } from './ClinicalRecords.types';

export type {
  ClinicalRecord,
  ClinicalDocumentSample,
  ClinicalNoteAccessProbeResult,
  ClinicalRecordQueryOptions,
  ClinicalRecordsAuthResult,
} from './ClinicalRecords.types';
