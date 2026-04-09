/**
 * Mock Health Data
 *
 * Development-only mock of Apple Health clinical records for a realistic
 * BPH patient profile (Robert J., 68yo male). Used in dev mode when no
 * real HealthKit records are connected.
 *
 * FHIR R4 resources are structured to trigger code-based matching
 * (SNOMED CT for conditions, LOINC for labs) and text-based matching
 * for medications, giving high-confidence prefill results.
 */

import type { ClinicalRecordsInput, HealthKitDemographics } from '@/lib/services/fhir/types';

export function getMockDemographics(): HealthKitDemographics {
  return {
    age: 68,
    dateOfBirth: '1957-03-12',
    biologicalSex: 'male',
  };
}

export function getMockClinicalRecords(): ClinicalRecordsInput {
  return {
    medications: [
      {
        displayName: 'tamsulosin 0.4 mg oral capsule',
        fhirResource: {
          resourceType: 'MedicationRequest',
          status: 'active',
          medicationCodeableConcept: {
            coding: [
              {
                system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                code: '29046',
                display: 'tamsulosin',
              },
            ],
            text: 'tamsulosin 0.4 mg oral capsule',
          },
          authoredOn: '2023-06-15',
        },
      },
      {
        displayName: 'finasteride 5 mg oral tablet',
        fhirResource: {
          resourceType: 'MedicationRequest',
          status: 'active',
          medicationCodeableConcept: {
            coding: [
              {
                system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                code: '310361',
                display: 'finasteride',
              },
            ],
            text: 'finasteride 5 mg oral tablet',
          },
          authoredOn: '2022-11-20',
        },
      },
      {
        displayName: 'lisinopril 10 mg oral tablet',
        fhirResource: {
          resourceType: 'MedicationRequest',
          status: 'active',
          medicationCodeableConcept: {
            coding: [
              {
                system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                code: '29046',
                display: 'lisinopril',
              },
            ],
            text: 'lisinopril 10 mg oral tablet',
          },
          authoredOn: '2020-04-10',
        },
      },
      {
        displayName: 'metformin 500 mg oral tablet',
        fhirResource: {
          resourceType: 'MedicationRequest',
          status: 'active',
          medicationCodeableConcept: {
            coding: [
              {
                system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                code: '6809',
                display: 'metformin',
              },
            ],
            text: 'metformin 500 mg oral tablet',
          },
          authoredOn: '2019-07-22',
        },
      },
    ],

    labResults: [
      {
        displayName: 'PSA [Mass/volume] in Serum or Plasma',
        fhirResource: {
          resourceType: 'Observation',
          status: 'final',
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '2857-1',
                display: 'PSA [Mass/volume] in Serum or Plasma',
              },
            ],
          },
          valueQuantity: { value: 4.2, unit: 'ng/mL' },
          effectiveDateTime: '2025-01-15',
          referenceRange: [{ text: '0.0–4.0 ng/mL' }],
        },
      },
      {
        displayName: 'Hemoglobin A1c/Hemoglobin.total in Blood',
        fhirResource: {
          resourceType: 'Observation',
          status: 'final',
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '4548-4',
                display: 'Hemoglobin A1c/Hemoglobin.total in Blood',
              },
            ],
          },
          valueQuantity: { value: 6.8, unit: '%' },
          effectiveDateTime: '2024-12-10',
          referenceRange: [{ text: '<5.7%' }],
        },
      },
    ],

    conditions: [
      {
        displayName: 'Benign prostatic hyperplasia (BPH)',
        fhirResource: {
          resourceType: 'Condition',
          clinicalStatus: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                code: 'active',
              },
            ],
          },
          code: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '266569009',
                display: 'Benign prostatic hyperplasia',
              },
            ],
            text: 'Benign prostatic hyperplasia (BPH)',
          },
          onsetDateTime: '2018-05-01',
        },
      },
      {
        displayName: 'Type 2 diabetes mellitus',
        fhirResource: {
          resourceType: 'Condition',
          clinicalStatus: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                code: 'active',
              },
            ],
          },
          code: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '73211009',
                display: 'Type 2 diabetes mellitus',
              },
            ],
            text: 'Type 2 diabetes mellitus',
          },
          onsetDateTime: '2015-03-15',
        },
      },
      {
        displayName: 'Essential hypertension',
        fhirResource: {
          resourceType: 'Condition',
          clinicalStatus: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                code: 'active',
              },
            ],
          },
          code: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '38341003',
                display: 'Essential hypertension',
              },
            ],
            text: 'Essential hypertension',
          },
          onsetDateTime: '2016-09-20',
        },
      },
    ],

    procedures: [
      {
        displayName: 'TURP - Transurethral Resection of Prostate',
        fhirResource: {
          resourceType: 'Procedure',
          status: 'completed',
          code: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '176103002',
                display: 'Transurethral resection of prostate',
              },
            ],
            text: 'TURP - Transurethral Resection of Prostate',
          },
          performedDateTime: '2019-03-22',
        },
      },
      {
        displayName: 'Laparoscopic appendectomy',
        fhirResource: {
          resourceType: 'Procedure',
          status: 'completed',
          code: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '80146002',
                display: 'Appendectomy',
              },
            ],
            text: 'Laparoscopic appendectomy',
          },
          performedDateTime: '2015-08-14',
        },
      },
    ],
  };
}
