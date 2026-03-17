/**
 * Procedure Mapper
 *
 * Separates BPH-related procedures from general surgical history
 * using keyword matching on procedure names and codes.
 */

import type { MappedProcedure, PrefillSource } from './types';
import { BPH_PROCEDURE_KEYWORDS } from './codes';
import { parseProcedureRecord } from './fhir-parser';

type ClinicalProcRecord = {
  displayName: string;
  fhirResource?: Record<string, unknown>;
};

function isBPHProcedure(name: string): boolean {
  const lower = name.toLowerCase();
  return BPH_PROCEDURE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export function mapProcedures(records: ClinicalProcRecord[]): MappedProcedure[] {
  return records.map((record) => {
    const normalized = parseProcedureRecord(
      record.fhirResource as Record<string, unknown> | undefined,
      record.displayName,
    );

    const procName = normalized.name || record.displayName;
    const isBPH = isBPHProcedure(procName);

    const source: PrefillSource = {
      type: 'clinical_record',
      displayName: procName,
      matchMethod: normalized.code?.code ? 'code' : 'text',
      matchedCode: normalized.code?.code
        ? `${normalized.code.system ?? 'unknown'}|${normalized.code.code}`
        : undefined,
    };

    return {
      name: procName,
      date: normalized.performedDate,
      isBPH,
      source,
    };
  });
}

export function separateProcedures(procedures: MappedProcedure[]): {
  bphProcedures: MappedProcedure[];
  otherProcedures: MappedProcedure[];
} {
  const bphProcedures: MappedProcedure[] = [];
  const otherProcedures: MappedProcedure[] = [];

  for (const proc of procedures) {
    if (proc.isBPH) {
      bphProcedures.push(proc);
    } else {
      otherProcedures.push(proc);
    }
  }

  return { bphProcedures, otherProcedures };
}
