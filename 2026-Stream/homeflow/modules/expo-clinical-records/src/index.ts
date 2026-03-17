export {
  isClinicalRecordsAvailable,
  requestClinicalRecordsAuthorization,
  getClinicalRecords,
  getSupportedTypes,
} from './ClinicalRecords';

export { ClinicalRecordType } from './ClinicalRecords.types';

export type {
  ClinicalRecord,
  ClinicalRecordQueryOptions,
  ClinicalRecordsAuthResult,
} from './ClinicalRecords.types';
