/**
 * FHIR Prefill → Firestore sync.
 *
 * Fetches real structured clinical records (medications, lab results,
 * conditions, procedures) and demographics from Apple HealthKit, runs them
 * through the deterministic FHIR parser, and writes the resulting
 * MedicalHistoryPrefill to Firestore.
 *
 * Firestore path
 * ──────────────
 *   users/{uid}/medical_history_prefill/latest
 *     — full MedicalHistoryPrefill JSON (machine-parsed, unconfirmed)
 *     — generatedAt (server timestamp)
 *     — sourceRecordCounts (how many records fed the parser)
 *
 * This document is the raw prefill. The user-confirmed, combined document
 * lives at users/{uid}/medical_history/current and is written when the
 * user completes the Medical History onboarding screen.
 *
 * This document is overwritten on every sync; it always reflects the
 * most recent clinical records available on the device.
 */

import { Platform } from 'react-native';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import {
  getAllClinicalRecords,
  getDemographics,
} from '@/lib/services/healthkit';
import {
  buildMedicalHistoryPrefill,
} from '@/lib/services/fhir';
import type {
  ClinicalRecordsInput,
  HealthKitDemographics,
  MedicalHistoryPrefill,
} from '@/lib/services/fhir';
import { db, getAuth } from './firestore';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SyncFhirPrefillResult {
  ok: boolean;
  prefill?: MedicalHistoryPrefill;
  sourceRecordCounts?: {
    medications: number;
    labResults: number;
    conditions: number;
    procedures: number;
  };
  error?: string;
}

// ── syncFhirPrefill ───────────────────────────────────────────────────────────

/**
 * Fetches clinical records and demographics from HealthKit, runs the FHIR
 * parser, and writes the MedicalHistoryPrefill to Firestore.
 *
 * Safe to call on every sign-in — always overwrites with the freshest data.
 */
export async function syncFhirPrefill(): Promise<SyncFhirPrefillResult> {
  if (Platform.OS !== 'ios') {
    return { ok: true };
  }

  const uid = getAuth().currentUser?.uid;
  if (!uid) {
    return { ok: false, error: 'no-auth: user is not signed in' };
  }

  try {
    console.log('[FhirPrefill] Fetching clinical records and demographics…');

    // Fetch in parallel — separate HealthKit APIs, no contention
    const [records, demographics] = await Promise.all([
      getAllClinicalRecords(),
      getDemographics(),
    ]);

    const sourceRecordCounts = {
      medications: records.medications.length,
      labResults: records.labResults.length,
      conditions: records.conditions.length,
      procedures: records.procedures.length,
    };

    console.log('[FhirPrefill] Record counts:', sourceRecordCounts);

    // Map ClinicalRecord[] → ClinicalRecordsInput (parser's expected shape)
    const clinicalInput: ClinicalRecordsInput = {
      medications: records.medications.map((r) => ({
        displayName: r.displayName,
        fhirResource: r.fhirResource,
      })),
      labResults: records.labResults.map((r) => ({
        displayName: r.displayName,
        fhirResource: r.fhirResource,
      })),
      conditions: records.conditions.map((r) => ({
        displayName: r.displayName,
        fhirResource: r.fhirResource,
      })),
      procedures: records.procedures.map((r) => ({
        displayName: r.displayName,
        fhirResource: r.fhirResource,
      })),
    };

    const hkDemographics: HealthKitDemographics = {
      age: demographics.age,
      dateOfBirth: demographics.dateOfBirth,
      biologicalSex: demographics.biologicalSex,
    };

    // Run the deterministic FHIR parser
    const prefill = buildMedicalHistoryPrefill(clinicalInput, hkDemographics);

    // Write to Firestore — overwrite on each sync so it's always current
    const ref = doc(db, `users/${uid}/medical_history_prefill/latest`);
    await setDoc(ref, {
      ...prefill,
      generatedAt: serverTimestamp(),
      sourceRecordCounts,
    });

    console.log('[FhirPrefill] Written to Firestore → users/' + uid + '/medical_history_prefill/latest');
    return { ok: true, prefill, sourceRecordCounts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[FhirPrefill] syncFhirPrefill error:', message);
    return { ok: false, error: message };
  }
}
