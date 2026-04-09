/**
 * Condition Mapper
 *
 * Maps clinical condition records to known categories:
 * diabetes, hypertension, BPH, or other.
 * Uses SNOMED/ICD-10 codes first, then text-based fallback.
 */

import type { MappedCondition, PrefillSource, KnownCondition, NormalizedCondition } from './types';
import { SNOMED, ICD10_PREFIXES, CONDITION_TEXT_PATTERNS } from './codes';
import { parseConditionRecord } from './fhir-parser';

type ClinicalCondRecord = {
  displayName: string;
  fhirResource?: Record<string, unknown>;
};

function matchCodeToCategory(
  code: string | undefined,
  system: string | undefined,
): { category: KnownCondition; matchedCode: string } | null {
  if (!code) return null;

  const isSNOMED = system?.includes('snomed') ?? false;
  const isICD10 = system?.includes('icd') ?? false;

  // SNOMED matches
  if (isSNOMED || !system) {
    if (code === SNOMED.DIABETES) return { category: 'diabetes', matchedCode: `SNOMED|${code}` };
    if (code === SNOMED.HYPERTENSION) return { category: 'hypertension', matchedCode: `SNOMED|${code}` };
    if (code === SNOMED.BPH || code === SNOMED.BPH_ALT) return { category: 'bph', matchedCode: `SNOMED|${code}` };
  }

  // ICD-10 matches (prefix-based)
  if (isICD10 || !system) {
    const upper = code.toUpperCase();
    if (upper.startsWith(ICD10_PREFIXES.DIABETES_TYPE1) ||
        upper.startsWith(ICD10_PREFIXES.DIABETES_TYPE2) ||
        upper.startsWith(ICD10_PREFIXES.DIABETES_OTHER)) {
      return { category: 'diabetes', matchedCode: `ICD-10|${code}` };
    }
    for (const prefix of ICD10_PREFIXES.HYPERTENSION) {
      if (upper.startsWith(prefix)) {
        return { category: 'hypertension', matchedCode: `ICD-10|${code}` };
      }
    }
    if (upper.startsWith(ICD10_PREFIXES.BPH)) {
      return { category: 'bph', matchedCode: `ICD-10|${code}` };
    }
  }

  return null;
}

function matchTextToCategory(name: string): KnownCondition {
  const lower = name.toLowerCase();

  for (const pattern of CONDITION_TEXT_PATTERNS.diabetes) {
    if (lower.includes(pattern)) return 'diabetes';
  }
  for (const pattern of CONDITION_TEXT_PATTERNS.hypertension) {
    if (lower.includes(pattern)) return 'hypertension';
  }
  for (const pattern of CONDITION_TEXT_PATTERNS.bph) {
    if (lower.includes(pattern)) return 'bph';
  }

  return 'other';
}

function mapSingleCondition(
  normalized: NormalizedCondition,
  displayName: string,
): MappedCondition {
  const condName = normalized.name || displayName;

  // Try code-based match
  const codeMatch = matchCodeToCategory(normalized.code?.code, normalized.code?.system);
  if (codeMatch) {
    const source: PrefillSource = {
      type: 'clinical_record',
      displayName: condName,
      matchMethod: 'code',
      matchedCode: codeMatch.matchedCode,
    };
    return { name: condName, category: codeMatch.category, source };
  }

  // Text-based match
  const category = matchTextToCategory(condName);
  const source: PrefillSource = {
    type: 'clinical_record',
    displayName: condName,
    matchMethod: 'text',
  };
  return { name: condName, category, source };
}

export function mapConditions(records: ClinicalCondRecord[]): MappedCondition[] {
  return records.map((record) => {
    const normalized = parseConditionRecord(
      record.fhirResource as Record<string, unknown> | undefined,
      record.displayName,
    );
    return mapSingleCondition(normalized, record.displayName);
  });
}

export function groupByCategory(conditions: MappedCondition[]): {
  diabetes: MappedCondition[];
  hypertension: MappedCondition[];
  bph: MappedCondition[];
  other: MappedCondition[];
} {
  const groups = {
    diabetes: [] as MappedCondition[],
    hypertension: [] as MappedCondition[],
    bph: [] as MappedCondition[],
    other: [] as MappedCondition[],
  };

  for (const cond of conditions) {
    groups[cond.category].push(cond);
  }

  return groups;
}
