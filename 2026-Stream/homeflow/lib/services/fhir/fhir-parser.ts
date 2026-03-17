/**
 * FHIR Parser
 *
 * Parses raw FHIR JSON from Apple Health clinical records into
 * normalized resource types. Handles both DSTU2 and R4 formats,
 * as well as Bundle vs single-resource payloads.
 */

import type {
  NormalizedMedication,
  NormalizedObservation,
  NormalizedCondition,
  NormalizedProcedure,
  NormalizedResource,
} from './types';

type FhirJson = Record<string, unknown>;

// ── Coding helpers ──────────────────────────────────────────────────

interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

function extractCodings(codeableConcept: unknown): FhirCoding[] {
  if (!codeableConcept || typeof codeableConcept !== 'object') return [];
  const cc = codeableConcept as Record<string, unknown>;

  const codings: FhirCoding[] = [];
  if (Array.isArray(cc.coding)) {
    for (const c of cc.coding) {
      if (c && typeof c === 'object') {
        codings.push({
          system: typeof c.system === 'string' ? c.system : undefined,
          code: typeof c.code === 'string' ? c.code : undefined,
          display: typeof c.display === 'string' ? c.display : undefined,
        });
      }
    }
  }

  // Fallback: text field
  if (codings.length === 0 && typeof cc.text === 'string') {
    codings.push({ display: cc.text });
  }

  return codings;
}

function primaryCoding(codeableConcept: unknown): FhirCoding | undefined {
  const codings = extractCodings(codeableConcept);
  return codings[0];
}

function getDisplayName(codeableConcept: unknown): string {
  const cc = codeableConcept as Record<string, unknown> | undefined;
  if (!cc) return '';

  // Prefer text field
  if (typeof cc.text === 'string') return cc.text;

  // Fall back to first coding display
  const coding = primaryCoding(cc);
  return coding?.display ?? '';
}

function safeString(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined;
}

// ── Extract date from various FHIR date fields ─────────────────────

function extractDate(resource: FhirJson, ...fields: string[]): string | undefined {
  for (const field of fields) {
    const val = resource[field];
    if (typeof val === 'string') return val;
    // Handle Period objects (effectivePeriod, performedPeriod)
    if (val && typeof val === 'object' && 'start' in (val as object)) {
      const period = val as Record<string, unknown>;
      if (typeof period.start === 'string') return period.start;
    }
  }
  return undefined;
}

// ── Extract quantity value ──────────────────────────────────────────

function extractQuantityValue(resource: FhirJson): { value?: number; unit?: string } {
  // valueQuantity
  const vq = resource.valueQuantity as Record<string, unknown> | undefined;
  if (vq && typeof vq.value === 'number') {
    return { value: vq.value, unit: safeString(vq.unit) };
  }

  // valueString → try parsing number
  if (typeof resource.valueString === 'string') {
    const parsed = parseFloat(resource.valueString);
    if (!isNaN(parsed)) return { value: parsed };
  }

  return {};
}

// ── Extract reference range ─────────────────────────────────────────

function extractReferenceRange(resource: FhirJson): string | undefined {
  const ranges = resource.referenceRange;
  if (!Array.isArray(ranges) || ranges.length === 0) return undefined;

  const range = ranges[0] as Record<string, unknown>;
  if (typeof range.text === 'string') return range.text;

  const low = range.low as Record<string, unknown> | undefined;
  const high = range.high as Record<string, unknown> | undefined;
  if (low?.value !== undefined || high?.value !== undefined) {
    const lowVal = typeof low?.value === 'number' ? low.value : '?';
    const highVal = typeof high?.value === 'number' ? high.value : '?';
    const unit = safeString(low?.unit) ?? safeString(high?.unit) ?? '';
    return `${lowVal}-${highVal} ${unit}`.trim();
  }

  return undefined;
}

// ── Resource Parsers ────────────────────────────────────────────────

function parseMedication(resource: FhirJson): NormalizedMedication {
  const rt = resource.resourceType as string;

  // R4: MedicationRequest, DSTU2: MedicationOrder
  let name = '';
  const medicationCC = resource.medicationCodeableConcept;
  if (medicationCC) {
    name = getDisplayName(medicationCC);
  } else if (resource.medicationReference && typeof resource.medicationReference === 'object') {
    const ref = resource.medicationReference as Record<string, unknown>;
    name = safeString(ref.display) ?? '';
  }

  // MedicationStatement uses medication[x] too
  if (!name && resource.medication) {
    name = getDisplayName(resource.medication);
  }

  return {
    resourceType: rt as NormalizedMedication['resourceType'],
    name,
    code: primaryCoding(resource.medicationCodeableConcept ?? resource.medication),
    status: safeString(resource.status),
    dateWritten: extractDate(resource, 'dateWritten', 'authoredOn', 'dateAsserted'),
  };
}

function parseObservation(resource: FhirJson): NormalizedObservation {
  const { value, unit } = extractQuantityValue(resource);

  return {
    resourceType: 'Observation',
    code: primaryCoding(resource.code),
    value,
    unit,
    valueString: typeof resource.valueString === 'string' ? resource.valueString : undefined,
    effectiveDate: extractDate(resource, 'effectiveDateTime', 'effectivePeriod', 'issued'),
    status: safeString(resource.status),
    referenceRange: extractReferenceRange(resource),
  };
}

function parseCondition(resource: FhirJson): NormalizedCondition {
  return {
    resourceType: 'Condition',
    name: getDisplayName(resource.code),
    code: primaryCoding(resource.code),
    clinicalStatus: (() => {
      // R4: clinicalStatus is a CodeableConcept
      const cs = resource.clinicalStatus;
      if (typeof cs === 'string') return cs;
      if (cs && typeof cs === 'object') return getDisplayName(cs) || undefined;
      return undefined;
    })(),
    onsetDate: extractDate(resource, 'onsetDateTime', 'onsetPeriod', 'recordedDate'),
  };
}

function parseProcedure(resource: FhirJson): NormalizedProcedure {
  return {
    resourceType: 'Procedure',
    name: getDisplayName(resource.code),
    code: primaryCoding(resource.code),
    status: safeString(resource.status),
    performedDate: extractDate(resource, 'performedDateTime', 'performedPeriod'),
  };
}

// ── Bundle handling ─────────────────────────────────────────────────

function extractResourcesFromBundle(bundle: FhirJson): FhirJson[] {
  const entry = bundle.entry;
  if (!Array.isArray(entry)) return [];

  return entry
    .map((e: Record<string, unknown>) => e.resource as FhirJson)
    .filter((r): r is FhirJson => r != null && typeof r.resourceType === 'string');
}

// ── Public API ──────────────────────────────────────────────────────

export function parseResource(fhirJson: FhirJson | undefined | null): NormalizedResource | null {
  if (!fhirJson || typeof fhirJson.resourceType !== 'string') return null;

  const rt = fhirJson.resourceType as string;

  switch (rt) {
    case 'MedicationOrder':
    case 'MedicationRequest':
    case 'MedicationStatement':
      return parseMedication(fhirJson);

    case 'Observation':
    case 'DiagnosticReport':
      return parseObservation(fhirJson);

    case 'Condition':
      return parseCondition(fhirJson);

    case 'Procedure':
      return parseProcedure(fhirJson);

    default:
      return null;
  }
}

export function parseFhirPayload(fhirJson: FhirJson | undefined | null): NormalizedResource[] {
  if (!fhirJson) return [];

  // Handle Bundle
  if (fhirJson.resourceType === 'Bundle') {
    const resources = extractResourcesFromBundle(fhirJson);
    return resources.map(parseResource).filter((r): r is NormalizedResource => r !== null);
  }

  // Single resource
  const parsed = parseResource(fhirJson);
  return parsed ? [parsed] : [];
}

export function parseMedicationRecord(
  fhirJson: FhirJson | undefined | null,
  displayName: string,
): NormalizedMedication {
  if (fhirJson) {
    const parsed = parseResource(fhirJson);
    if (parsed && 'name' in parsed && (parsed as NormalizedMedication).resourceType) {
      const med = parsed as NormalizedMedication;
      if (!med.name && displayName) med.name = displayName;
      return med;
    }
  }

  // Fallback: use display name only
  return {
    resourceType: 'MedicationOrder',
    name: displayName,
  };
}

export function parseObservationRecord(
  fhirJson: FhirJson | undefined | null,
  displayName: string,
): NormalizedObservation {
  if (fhirJson) {
    const resources = parseFhirPayload(fhirJson);
    const obs = resources.find((r) => r.resourceType === 'Observation') as NormalizedObservation | undefined;
    if (obs) return obs;
  }

  return {
    resourceType: 'Observation',
    code: { display: displayName },
  };
}

export function parseConditionRecord(
  fhirJson: FhirJson | undefined | null,
  displayName: string,
): NormalizedCondition {
  if (fhirJson) {
    const parsed = parseResource(fhirJson);
    if (parsed?.resourceType === 'Condition') {
      const cond = parsed as NormalizedCondition;
      if (!cond.name && displayName) cond.name = displayName;
      return cond;
    }
  }

  return {
    resourceType: 'Condition',
    name: displayName,
  };
}

export function parseProcedureRecord(
  fhirJson: FhirJson | undefined | null,
  displayName: string,
): NormalizedProcedure {
  if (fhirJson) {
    const parsed = parseResource(fhirJson);
    if (parsed?.resourceType === 'Procedure') {
      const proc = parsed as NormalizedProcedure;
      if (!proc.name && displayName) proc.name = displayName;
      return proc;
    }
  }

  return {
    resourceType: 'Procedure',
    name: displayName,
  };
}
