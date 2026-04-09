/**
 * Medication Classifier
 *
 * Classifies medications from clinical records into BPH drug classes.
 * Uses code-based matching (RxNorm) first, then text-based fallback.
 */

import type { ClassifiedMedication, PrefillSource, NormalizedMedication } from './types';
import { BPH_DRUGS, DRUG_NAME_MAP } from './codes';
import { parseMedicationRecord } from './fhir-parser';

type ClinicalMedRecord = {
  displayName: string;
  fhirResource?: Record<string, unknown>;
};

function matchByText(name: string): { drug: (typeof BPH_DRUGS)[number]; matchedName: string } | null {
  const lower = name.toLowerCase();
  for (const drug of BPH_DRUGS) {
    if (lower.includes(drug.generic)) {
      return { drug, matchedName: drug.generic };
    }
    for (const brand of drug.brands) {
      if (lower.includes(brand)) {
        return { drug, matchedName: brand };
      }
    }
  }
  return null;
}

function classifySingleMedication(
  normalized: NormalizedMedication,
  displayName: string,
): ClassifiedMedication {
  const medName = normalized.name || displayName;

  // Try code-based match first (RxNorm)
  if (normalized.code?.code) {
    const codeLower = (normalized.code.display ?? '').toLowerCase();
    const codeMatch = matchByText(codeLower);
    if (codeMatch) {
      const source: PrefillSource = {
        type: 'clinical_record',
        displayName: medName,
        matchMethod: 'code',
        matchedCode: `${normalized.code.system ?? 'unknown'}|${normalized.code.code}`,
      };
      return {
        name: medName,
        genericName: codeMatch.drug.generic,
        drugClass: codeMatch.drug.class,
        source,
      };
    }
  }

  // Text-based match on medication name
  const textMatch = matchByText(medName);
  if (textMatch) {
    const source: PrefillSource = {
      type: 'clinical_record',
      displayName: medName,
      matchMethod: 'text',
    };
    return {
      name: medName,
      genericName: textMatch.drug.generic,
      drugClass: textMatch.drug.class,
      source,
    };
  }

  // No match - unrelated medication
  const source: PrefillSource = {
    type: 'clinical_record',
    displayName: medName,
    matchMethod: 'text',
  };
  return {
    name: medName,
    drugClass: 'unrelated',
    source,
  };
}

export function classifyMedications(records: ClinicalMedRecord[]): ClassifiedMedication[] {
  return records.map((record) => {
    const normalized = parseMedicationRecord(
      record.fhirResource as Record<string, unknown> | undefined,
      record.displayName,
    );
    return classifySingleMedication(normalized, record.displayName);
  });
}

export function groupByDrugClass(medications: ClassifiedMedication[]): {
  alphaBlockers: ClassifiedMedication[];
  fiveARIs: ClassifiedMedication[];
  anticholinergics: ClassifiedMedication[];
  beta3Agonists: ClassifiedMedication[];
  otherBPH: ClassifiedMedication[];
  unrelated: ClassifiedMedication[];
} {
  const groups = {
    alphaBlockers: [] as ClassifiedMedication[],
    fiveARIs: [] as ClassifiedMedication[],
    anticholinergics: [] as ClassifiedMedication[],
    beta3Agonists: [] as ClassifiedMedication[],
    otherBPH: [] as ClassifiedMedication[],
    unrelated: [] as ClassifiedMedication[],
  };

  for (const med of medications) {
    switch (med.drugClass) {
      case 'alpha_blocker':
        groups.alphaBlockers.push(med);
        break;
      case 'five_ari':
        groups.fiveARIs.push(med);
        break;
      case 'anticholinergic':
        groups.anticholinergics.push(med);
        break;
      case 'beta3_agonist':
        groups.beta3Agonists.push(med);
        break;
      case 'other_bph':
        groups.otherBPH.push(med);
        break;
      default:
        groups.unrelated.push(med);
        break;
    }
  }

  return groups;
}
