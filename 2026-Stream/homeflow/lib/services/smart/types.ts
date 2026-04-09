export interface SmartHealthSystem {
  id: string;
  name: string;
  issuer: string;
  fhirBaseUrl: string;
  clientId?: string;
  vendor?: 'epic' | 'other' | 'generic';
  authorizationStyle?: 'standalone_patient';
  /** Override the authorization endpoint URL (defaults to issuer + /oauth2/authorize) */
  authorizationEndpoint?: string;
  /** Override the token endpoint URL (defaults to issuer + /oauth2/token) */
  tokenEndpoint?: string;
  /** If true, skip OAuth and access FHIR directly (open/unauthenticated server) */
  openAccess?: boolean;
  /** Patient ID to use when openAccess is true */
  testPatientId?: string;
}

export interface SmartConnectionSummary {
  providerId: string;
  providerName: string;
  issuer: string;
  fhirBaseUrl: string;
  status: 'connected' | 'disconnected' | 'error';
  connectedAt?: string | null;
  expiresAt?: string | null;
  lastSyncedAt?: string | null;
}
