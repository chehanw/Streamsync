import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';

import type {
  ClinicalRecordsInput,
  HealthKitDemographics,
} from '@/lib/services/fhir';
import { getAuth } from '@/src/services/firestore';
import type { SmartConnectionSummary, SmartHealthSystem } from './types';

WebBrowser.maybeCompleteAuthSession();

const FUNCTIONS_BASE_URL =
  process.env.EXPO_PUBLIC_FUNCTIONS_BASE_URL ||
  'https://us-central1-streamsync-8ae79.cloudfunctions.net';

const DEFAULT_SMART_SCOPES = [
  'openid',
  'offline_access',
  'launch/patient',
  'patient/Patient.read',
  'patient/MedicationRequest.read',
  'patient/Observation.read',
  'patient/AllergyIntolerance.read',
  'patient/Condition.read',
  'patient/Procedure.read',
  'patient/DocumentReference.read',
  'patient/DiagnosticReport.read',
  'patient/Binary.read',
];

interface AuthorizeUrlResponse {
  url: string;
}

interface CompleteConnectionResponse {
  connection: SmartConnectionSummary;
}

export interface SmartSyncResponse {
  connection: SmartConnectionSummary;
  demographics: HealthKitDemographics;
  clinicalRecords: ClinicalRecordsInput & {
    notes?: Array<{ displayName: string; fhirResource?: Record<string, unknown> }>;
  };
  syncIssues?: Array<{
    resourceType: string;
    error: string;
    url: string;
  }>;
  syncWarning?: string | null;
  fetchedAt: string;
}

async function getFirebaseBearerToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) {
    throw new Error('You must be signed in before connecting a health system.');
  }
  return user.getIdToken();
}

async function getJson<T>(path: string, queryParams: Record<string, string>): Promise<T> {
  const bearer = await getFirebaseBearerToken();
  const url = new URL(`${FUNCTIONS_BASE_URL}/${path}`);
  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${bearer}`,
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }

  return payload as T;
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const bearer = await getFirebaseBearerToken();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }

  return payload as T;
}

function buildRedirectUri(): string {
  // Use 'smart-callback' without leading slash so Linking.createURL produces
  // my-app://smart-callback (double-slash) to match the Epic App Orchard registration.
  // With a leading slash it would produce my-app:///smart-callback (triple-slash).
  return Linking.createURL('smart-callback');
}

function toCodeChallenge(codeVerifier: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    codeVerifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  ).then((value) =>
    value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''),
  );
}

function randomBase64Url(bytes = 32): Promise<string> {
  return Crypto.getRandomBytesAsync(bytes).then((buffer) =>
    Array.from(buffer, (value) => value.toString(16).padStart(2, '0')).join(''),
  );
}

export async function connectSmartHealthSystem(
  healthSystem: SmartHealthSystem,
): Promise<SmartConnectionSummary> {
  const redirectUri = buildRedirectUri();
  const [state, codeVerifier] = await Promise.all([
    randomBase64Url(16),
    randomBase64Url(32),
  ]);
  const codeChallenge = await toCodeChallenge(codeVerifier);

  const scope = DEFAULT_SMART_SCOPES.join(' ');

  const authorize = await getJson<AuthorizeUrlResponse>('smartAuthorizeUrl', {
    providerId: healthSystem.id,
    redirectUri,
    state,
    codeChallenge,
    scope,
  });

  const result = await WebBrowser.openAuthSessionAsync(authorize.url, redirectUri);
  if (result.type !== 'success' || !result.url) {
    throw new Error('The provider sign-in flow was cancelled.');
  }

  const callbackUrl = new URL(result.url);
  const code = callbackUrl.searchParams.get('code');
  const returnedState = callbackUrl.searchParams.get('state');
  const error = callbackUrl.searchParams.get('error');

  if (error) {
    throw new Error(`Provider authorization failed: ${error}`);
  }
  if (!code) {
    throw new Error('Provider authorization did not return a code.');
  }
  if (returnedState !== state) {
    throw new Error('Provider authorization state mismatch.');
  }

  const response = await postJson<CompleteConnectionResponse>('completeSmartConnection', {
    providerId: healthSystem.id,
    code,
    codeVerifier,
    redirectUri,
  });

  return response.connection;
}

export async function syncSmartClinicalData(
  providerId: string,
): Promise<SmartSyncResponse> {
  return postJson<SmartSyncResponse>('syncSmartClinicalData', { providerId });
}
