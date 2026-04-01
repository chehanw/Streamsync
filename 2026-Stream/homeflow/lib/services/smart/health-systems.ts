import type { SmartHealthSystem } from './types';

const EPIC_CLIENT_ID =
  process.env.EXPO_PUBLIC_EPIC_CLIENT_ID ||
  process.env.EXPO_PUBLIC_EPIC_SANDBOX_CLIENT_ID ||
  undefined;

const FALLBACK_SYSTEMS: SmartHealthSystem[] = [
  {
    id: 'epic-sandbox',
    name: 'Epic Sandbox',
    issuer: 'https://fhir.epic.com/interconnect-fhir-oauth',
    fhirBaseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    clientId: EPIC_CLIENT_ID,
    vendor: 'epic',
    authorizationStyle: 'standalone_patient',
  },
];

function withEnvClientId(system: SmartHealthSystem): SmartHealthSystem {
  if (system.clientId) return system;

  if (system.id === 'epic-sandbox' && EPIC_CLIENT_ID) {
    return {
      ...system,
      clientId: EPIC_CLIENT_ID,
    };
  }

  return system;
}

export function getAvailableSmartHealthSystems(): SmartHealthSystem[] {
  const raw = process.env.EXPO_PUBLIC_SMART_HEALTH_SYSTEMS_JSON;
  if (!raw) return FALLBACK_SYSTEMS;

  try {
    const parsed = JSON.parse(raw) as SmartHealthSystem[];
    if (!Array.isArray(parsed) || parsed.length === 0) return FALLBACK_SYSTEMS;
    return parsed
      .filter((system) =>
        Boolean(
          system.id &&
          system.name &&
          system.issuer &&
          system.fhirBaseUrl &&
          !system.openAccess,
        ),
      )
      .map(withEnvClientId);
  } catch (error) {
    console.warn('[SMART] Failed to parse EXPO_PUBLIC_SMART_HEALTH_SYSTEMS_JSON:', error);
    return FALLBACK_SYSTEMS;
  }
}
