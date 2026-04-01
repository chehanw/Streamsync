/**
 * Firestore read/write service for Throne uroflow data.
 *
 * All Throne paths are scoped under users/{uid}:
 *   throne_sessions/{sessionId}
 *   throne_metrics/{metricId}
 *
 * Surgery date is stored at:
 *   users/{uid}/surgery_date/current  →  { surgeryDate: "YYYY-MM-DD" }
 */

import {
  collection,
  query,
  where,
  getDocs,
  QueryConstraint,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import {db} from "./firebase";

export interface ThroneSession {
  id: string;
  studyId: string;
  tags: string[];
  created: string;
  updated: string;
  startTs: string;
  endTs: string;
  deviceId: string;
  userId: string;
  status: string;
  metricCount: number;
}

export interface ThroneMetric {
  id: string;
  studyId: string;
  sessionId: string;
  ts: string;
  created: string;
  updated: string;
  deleted: string | null;
  type: string;
  value: number | string;
  series: string;
  durationMicros: number;
}

/**
 * Fetch sessions for a user from Firestore.
 * Only returns sessions with at least one metric (metricCount > 0).
 * Date range filtering is applied client-side after the query.
 */
export async function fetchSessions(uid: string, opts?: {
  startDate?: Date;
  endDate?: Date;
}): Promise<ThroneSession[]> {
  const constraints: QueryConstraint[] = [
    where("metricCount", ">", 0),
  ];

  const q = query(collection(db, `users/${uid}/throne_sessions`), ...constraints);
  const snap = await getDocs(q);
  let sessions = snap.docs.map((d) => d.data() as ThroneSession);

  if (opts?.startDate || opts?.endDate) {
    const startMs = opts.startDate?.getTime() ?? 0;
    const endMs = opts.endDate?.getTime() ?? Infinity;
    sessions = sessions.filter((s) => {
      const ts = new Date(s.startTs).getTime();
      return ts >= startMs && ts <= endMs;
    });
  }

  sessions.sort((a, b) => new Date(b.startTs).getTime() - new Date(a.startTs).getTime());
  return sessions;
}

/**
 * Batch-fetch metrics for multiple sessions.
 * Firestore "in" supports up to 30 values — large arrays are split into
 * parallel batches automatically.
 */
export async function fetchMetricsBatch(uid: string, sessionIds: string[]): Promise<ThroneMetric[]> {
  if (sessionIds.length === 0) return [];

  const BATCH_SIZE = 30;
  const batches: string[][] = [];
  for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
    batches.push(sessionIds.slice(i, i + BATCH_SIZE));
  }

  const snapshots = await Promise.all(
    batches.map((batch) =>
      getDocs(query(
        collection(db, `users/${uid}/throne_metrics`),
        where("sessionId", "in", batch),
      )),
    ),
  );

  return snapshots.flatMap((snap) => snap.docs.map((d) => d.data() as ThroneMetric));
}

/**
 * Fetch all metrics for a single session, sorted ascending by timestamp.
 */
export async function fetchMetricsForSession(uid: string, sessionId: string): Promise<ThroneMetric[]> {
  const q = query(
    collection(db, `users/${uid}/throne_metrics`),
    where("sessionId", "==", sessionId),
  );
  const snap = await getDocs(q);
  const metrics = snap.docs.map((d) => d.data() as ThroneMetric);
  metrics.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  return metrics;
}

// ─── Surgery Date ─────────────────────────────────────────────────────────────

/**
 * Read surgery date from users/{uid}/surgery_date/current.
 * Returns an ISO date string (YYYY-MM-DD) or null if not set.
 */
export async function fetchSurgeryDate(uid: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, `users/${uid}/surgery_date/current`));
    if (snap.exists()) {
      const sd = snap.data()?.surgeryDate;
      if (typeof sd === "string" && sd) return sd.slice(0, 10);
      if (sd?.toDate) return (sd.toDate() as Date).toISOString().slice(0, 10);
    }
  } catch {
    // Document may not exist — return null
  }
  return null;
}

/**
 * Persist the Throne User ID to the root users/{uid} document.
 *
 * The syncThroneUserMap Cloud Function trigger watches users/{uid} and
 * automatically creates the throneUserMap/{throneUserId} → { firebaseUid }
 * reverse-lookup entry, so the ingestion function can route sessions to
 * the correct user without any manual CRC steps.
 */
export async function saveThroneUserId(uid: string, throneUserId: string): Promise<void> {
  await setDoc(
    doc(db, `users/${uid}`),
    { throneUserId, throneUserIdSetAt: new Date().toISOString() },
    { merge: true },
  );
}

export interface UserProfileDocument {
  name?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  updatedAt?: string;
  createdAt?: string;
}

/**
 * Persist app-collected profile fields to the root users/{uid} document.
 */
export async function saveUserProfile(uid: string, profile: UserProfileDocument): Promise<void> {
  const payload = Object.fromEntries(
    Object.entries({
      ...profile,
      updatedAt: profile.updatedAt ?? new Date().toISOString(),
    }).filter(([, value]) => value !== undefined),
  );

  if (Object.keys(payload).length === 0) {
    return;
  }

  await setDoc(
    doc(db, `users/${uid}`),
    payload,
    { merge: true },
  );
}

/**
 * Persist surgery date to users/{uid}/surgery_date/current.
 */
export async function saveSurgeryDate(uid: string, dateStr: string): Promise<void> {
  await setDoc(
    doc(db, `users/${uid}/surgery_date/current`),
    { surgeryDate: dateStr, updatedAt: new Date().toISOString() },
    { merge: true },
  );
}

// ─── Medical History ──────────────────────────────────────────────────────────

export interface MedHistoryMedication {
  name: string;
  brandName?: string;
  groupKey: string;          // alphaBlockers | fiveARIs | anticholinergics | beta3Agonists | otherBPH
}

export interface MedHistoryProcedure {
  name: string;
  commonName?: string;
  date?: string;  // year only (YYYY) — HIPAA Safe Harbor identifier #3
  isBPH: boolean;
}

export interface MedHistoryCondition {
  name: string;
}

export interface MedHistoryLabValue {
  value: number;
  unit: string;
  date: string;  // year only (YYYY) — HIPAA Safe Harbor identifier #3
  referenceRange?: string;
}

export interface MedHistoryDocument {
  // User-entered demographics (HIPAA Safe Harbor de-identified)
  demographics: {
    // name omitted — HIPAA identifier #1
    ethnicity: string;
    race: string;
    // From HealthKit prefill (not user-entered)
    age: number | '90+' | null;  // ages ≥89 stored as '90+' per HIPAA Safe Harbor
    biologicalSex: string | null;
    dateOfBirth: string | null;  // always null — not exposed by HealthKit demographics API
  };
  // User-confirmed (possibly edited) from prefill
  medications: MedHistoryMedication[];
  surgicalHistory: MedHistoryProcedure[];
  conditions: MedHistoryCondition[];
  // From FHIR prefill only — not collected in user form
  labs: {
    psa: MedHistoryLabValue | null;
    hba1c: MedHistoryLabValue | null;
    urinalysis: MedHistoryLabValue | null;
  };
  clinicalMeasurements: {
    pvr: MedHistoryLabValue | null;
    uroflowQmax: MedHistoryLabValue | null;
    volumeVoided: MedHistoryLabValue | null;
    mobility: string | null;
  };
  savedAt: unknown;           // serverTimestamp()
}

/**
 * Write combined medical history (user form + FHIR prefill remainder)
 * to users/{uid}/medical_history/current.
 * Overwrites on every call — always reflects latest confirmed data.
 */
export async function saveMedicalHistory(
  uid: string,
  data: Omit<MedHistoryDocument, 'savedAt'>,
): Promise<void> {
  await setDoc(
    doc(db, `users/${uid}/medical_history/current`),
    { ...data, savedAt: serverTimestamp() },
    { merge: false },
  );
}

export interface ConfirmedDemographicsPrefillInput {
  fullName: string;
  age: number | null;
  biologicalSex: string | null;
  ethnicity: string;
  race: string;
}

/**
 * Merge user-confirmed demographics into medical_history_prefill/latest so the
 * dashboard and downstream workflows can access the same confirmed values.
 */
export async function saveConfirmedDemographicsPrefill(
  uid: string,
  demographics: ConfirmedDemographicsPrefillInput,
): Promise<void> {
  const source = {
    type: 'user_input',
    displayName: 'Confirmed in mobile app',
    matchMethod: 'direct_api' as const,
  };

  const entry = <T>(value: T | null) => {
    const hasValue = typeof value === 'string'
      ? value.trim().length > 0
      : value != null;

    return {
      value: hasValue ? value : null,
      confidence: hasValue ? 'high' : 'none',
      sources: hasValue ? [source] : [],
    };
  };

  await setDoc(
    doc(db, `users/${uid}/medical_history_prefill/latest`),
    {
      demographics: {
        fullName: entry(demographics.fullName || null),
        age: entry(demographics.age),
        biologicalSex: entry(demographics.biologicalSex),
        ethnicity: entry(demographics.ethnicity || null),
        race: entry(demographics.race || null),
      },
      confirmedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
