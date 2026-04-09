import {
  collection,
  getDocs,
  limit,
  query,
  where,
  type Timestamp,
} from 'firebase/firestore';

import { db } from '@/src/services/firestore';
import type { SmartConnectionSummary } from './types';

export interface ConnectedSmartProviderStatus extends SmartConnectionSummary {
  noteCount: number | null;
  totalRecordCount: number | null;
  lastRecordCounts: {
    medications: number;
    labResults: number;
    conditions: number;
    procedures: number;
    notes: number;
  } | null;
}

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  if (typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

export async function getConnectedSmartProviderStatus(
  uid: string,
): Promise<ConnectedSmartProviderStatus | null> {
  const snapshot = await getDocs(
    query(
      collection(db, 'users', uid, 'provider_connections'),
      where('status', '==', 'connected'),
      limit(1),
    ),
  );

  if (snapshot.empty) {
    return null;
  }

  const data = snapshot.docs[0]?.data() as Record<string, unknown>;
  const lastRecordCounts =
    typeof data.lastRecordCounts === 'object' && data.lastRecordCounts
      ? (data.lastRecordCounts as Record<string, unknown>)
      : {};
  const normalizedCounts = {
    medications: typeof lastRecordCounts.medications === 'number' ? lastRecordCounts.medications : 0,
    labResults: typeof lastRecordCounts.labResults === 'number' ? lastRecordCounts.labResults : 0,
    conditions: typeof lastRecordCounts.conditions === 'number' ? lastRecordCounts.conditions : 0,
    procedures: typeof lastRecordCounts.procedures === 'number' ? lastRecordCounts.procedures : 0,
    notes: typeof lastRecordCounts.notes === 'number' ? lastRecordCounts.notes : 0,
  };
  const totalRecordCount = Object.values(normalizedCounts).reduce((sum, value) => sum + value, 0);

  return {
    providerId: typeof data.providerId === 'string' ? data.providerId : snapshot.docs[0]!.id,
    providerName: typeof data.providerName === 'string' ? data.providerName : 'Connected Provider',
    issuer: typeof data.issuer === 'string' ? data.issuer : '',
    fhirBaseUrl: typeof data.fhirBaseUrl === 'string' ? data.fhirBaseUrl : '',
    status: 'connected',
    connectedAt: toIsoString(data.connectedAt),
    expiresAt: toIsoString(data.expiresAt),
    lastSyncedAt: toIsoString(data.lastSyncedAt),
    noteCount: normalizedCounts.notes,
    totalRecordCount,
    lastRecordCounts: normalizedCounts,
  };
}
