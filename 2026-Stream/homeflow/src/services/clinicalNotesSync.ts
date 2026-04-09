/**
 * Clinical Notes → Firebase Storage sync pipeline.
 *
 * Pulls HKClinicalTypeIdentifierClinicalNoteRecord documents from Apple
 * HealthKit, extracts the embedded FHIR DocumentReference attachment
 * (typically a PDF or plain text), uploads the raw file to Firebase Storage,
 * and writes lightweight metadata to Firestore.
 *
 * Data model
 * ──────────
 *   Firebase Storage:
 *     users/{uid}/clinical-notes/{noteId}
 *       — raw document bytes (content-type preserved from FHIR attachment)
 *
 *   Firestore:
 *     users/{uid}/clinical_notes/{noteId}
 *       displayName, startDate, endDate, contentType, title?,
 *       storageRef, fhirResourceType?, fhirSourceURL?,
 *       medgemmaStatus, uploadedAt
 *
 * Idempotency
 * ───────────
 *   Before uploading, the pipeline checks whether the Firestore metadata doc
 *   already exists (keyed on the HealthKit UUID). Re-running is safe and cheap.
 *
 * MedGemma pipeline hook
 * ──────────────────────
 *   Every uploaded note is written with medgemmaStatus = 'pending'.
 *   The end-of-study batch job queries:
 *     where('medgemmaStatus', '==', 'pending')
 *   downloads from Storage, runs MedGemma, and updates to 'complete'.
 */

import { Platform } from 'react-native';
import { getApp } from 'firebase/app';
import { getStorage, ref, uploadString } from 'firebase/storage';
import {
  DocumentReference,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

import {
  getClinicalNotes,
  getHealthKitDocumentSamples,
  probeClinicalNoteAccess,
} from '@/lib/services/healthkit';
import type { ClinicalDocumentSample, ClinicalRecord } from '@/lib/services/healthkit';
import { db, getAuth } from './firestore';
import { parseClinicalAttachment } from './cdaParser';
import type { CdaSection } from './cdaParser';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SyncClinicalNotesResult {
  ok: boolean;
  uploaded: number;
  skipped: number;
  error?: string;
}

interface FhirAttachment {
  data?: string;        // base64-encoded document bytes
  contentType?: string; // e.g. "application/pdf", "text/plain"
  title?: string;
  size?: number;        // bytes (unencoded)
  url?: string;         // present when data is not embedded
}

interface ParsedNotePayload {
  parsedSections: CdaSection[];
  parsedText: string;
  parsedDocType: string;
  storagePath: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Allowlist of content types accepted from FHIR attachment metadata.
// Any value outside this set is coerced to application/octet-stream.
const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/xml',
  'application/xhtml+xml',
  'text/xml',
  'text/plain',
  'text/html',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts the first attachment from a FHIR DocumentReference resource.
 * Returns null if the resource is missing or malformed.
 */
function extractAttachment(
  fhirResource: Record<string, unknown> | undefined,
): FhirAttachment | null {
  if (!fhirResource) return null;

  const content = fhirResource['content'] as
    | { attachment?: Record<string, unknown> }[]
    | undefined;

  if (!Array.isArray(content) || content.length === 0) return null;

  const raw = content[0]?.attachment;
  if (!raw) return null;

  return {
    data: raw['data'] as string | undefined,
    contentType: raw['contentType'] as string | undefined,
    title: raw['title'] as string | undefined,
    size: raw['size'] as number | undefined,
    url: raw['url'] as string | undefined,
  };
}

async function uploadParsedDocument(
  uid: string,
  noteId: string,
  displayName: string,
  noteSourceURL: string | null | undefined,
  base64Data: string,
  contentType: string,
): Promise<ParsedNotePayload> {
  const parsed = parseClinicalAttachment(base64Data, contentType);
  const storagePath = `users/${uid}/clinical_notes/${noteId}`;
  const storage = getStorage(getApp());
  const storageRef = ref(storage, storagePath);

  if (parsed.decodedContent !== null) {
    await uploadString(storageRef, parsed.decodedContent, 'raw', {
      contentType: parsed.docType === 'cda' ? 'text/xml' : contentType,
      customMetadata: {
        noteId,
        displayName,
        docType: parsed.docType,
        fhirSourceURL: noteSourceURL ?? '',
      },
    });
  } else {
    await uploadString(storageRef, base64Data, 'base64', {
      contentType,
      customMetadata: {
        noteId,
        displayName,
        docType: 'pdf',
        fhirSourceURL: noteSourceURL ?? '',
      },
    });
  }

  return {
    parsedSections: parsed.sections,
    parsedText: parsed.plainText,
    parsedDocType: parsed.docType,
    storagePath,
  };
}

async function writeClinicalNoteMetadata(
  metaRef: DocumentReference,
  payload: {
    displayName: string;
    startDate: string;
    endDate: string;
    title?: string | null;
    attachmentUrl?: string | null;
    fhirResourceType?: string | null;
    fhirSourceURL?: string | null;
    contentType: string;
    parsedDocType: string;
    parsedText: string;
    parsedSections: CdaSection[];
    storagePath: string | null;
    sourceType?: string;
    sourceAuthor?: string | null;
    sourceCustodian?: string | null;
    sourcePatientName?: string | null;
  },
): Promise<void> {
  await setDoc(metaRef, {
    displayName: payload.displayName,
    startDate: Timestamp.fromDate(new Date(payload.startDate)),
    endDate: Timestamp.fromDate(new Date(payload.endDate)),
    contentType: payload.contentType,
    title: payload.title ?? null,
    storageRef: payload.storagePath,
    attachmentUrl: payload.attachmentUrl ?? null,
    fhirResourceType: payload.fhirResourceType ?? null,
    fhirSourceURL: payload.fhirSourceURL ?? null,
    parsedDocType: payload.parsedDocType,
    parsedText: payload.parsedText || null,
    parsedSections: payload.parsedSections.length > 0 ? payload.parsedSections : null,
    medgemmaStatus: payload.storagePath ? 'pending' : 'no-data',
    sourceType: payload.sourceType ?? 'healthkit_clinical_record',
    sourceAuthor: payload.sourceAuthor ?? null,
    sourceCustodian: payload.sourceCustodian ?? null,
    sourcePatientName: payload.sourcePatientName ?? null,
    uploadedAt: serverTimestamp(),
  });
}

async function syncDocumentSample(
  uid: string,
  sample: ClinicalDocumentSample,
): Promise<{ existed: boolean; uploaded: boolean }> {
  const noteId = `document-sample-${sample.id}`;
  const metaRef = doc(db, `users/${uid}/clinical_notes/${noteId}`);
  const existing = await getDoc(metaRef);
  if (existing.exists()) {
    return { existed: true, uploaded: false };
  }

  const contentType = 'text/xml';
  let parsedSections: CdaSection[] = [];
  let parsedText = '';
  let parsedDocType = 'unknown';
  let storagePath: string | null = null;

  if (sample.documentData) {
    const uploaded = await uploadParsedDocument(
      uid,
      noteId,
      sample.title ?? 'Clinical Document',
      null,
      sample.documentData,
      contentType,
    );
    parsedSections = uploaded.parsedSections;
    parsedText = uploaded.parsedText;
    parsedDocType = uploaded.parsedDocType;
    storagePath = uploaded.storagePath;
    console.log(
      `[ClinicalNotes] Imported document sample ${noteId} (docType=${uploaded.parsedDocType}, sections=${uploaded.parsedSections.length})`,
    );
  } else if (__DEV__) {
    console.log(
      `[ClinicalNotes] Document sample ${noteId} has no documentData — metadata only`,
    );
  }

  await writeClinicalNoteMetadata(metaRef, {
    displayName: sample.title ?? 'Clinical Document',
    startDate: sample.startDate,
    endDate: sample.endDate,
    title: sample.title ?? null,
    contentType,
    parsedDocType,
    parsedText,
    parsedSections,
    storagePath,
    sourceType: 'healthkit_document_sample',
    sourceAuthor: sample.authorName ?? null,
    sourceCustodian: sample.custodianName ?? null,
    sourcePatientName: sample.patientName ?? null,
  });

  return { existed: false, uploaded: !!storagePath };
}

// ── syncClinicalNotes ─────────────────────────────────────────────────────────

/**
 * Syncs all available clinical notes for the signed-in user.
 *
 * Every note gets a Firestore metadata document regardless of whether inline
 * attachment data is available. Storage upload only happens when the FHIR
 * attachment carries base64-encoded `data`; url-only references are recorded
 * in Firestore with storageRef: null so they still appear in the collection.
 */
export async function syncClinicalNotes(): Promise<SyncClinicalNotesResult> {
  if (Platform.OS !== 'ios') {
    return { ok: true, uploaded: 0, skipped: 0 };
  }

  const uid = getAuth().currentUser?.uid;
  if (!uid) {
    return {
      ok: false,
      uploaded: 0,
      skipped: 0,
      error: 'no-auth: user is not signed in',
    };
  }

  try {
    console.log('[ClinicalNotes] Starting sync…');
    const [notes, documentSamples, probe] = await Promise.all([
      getClinicalNotes(),
      getHealthKitDocumentSamples(),
      probeClinicalNoteAccess(),
    ]);
    console.log(`[ClinicalNotes] Found ${notes.length} note(s) in HealthKit`);
    console.log(
      `[ClinicalNotes] Probe: notes=${probe.clinicalNoteCount}, inline=${probe.notesWithInlineAttachmentData}, urlOnly=${probe.notesWithAttachmentUrlOnly}, noAttachment=${probe.notesWithoutAttachment}, documentSamples=${probe.documentSampleCount}, documentSamplesWithData=${probe.documentSamplesWithData}`,
    );

    if (notes.length === 0 && documentSamples.length === 0) {
      return { ok: true, uploaded: 0, skipped: 0 };
    }
    let uploaded = 0;
    let skipped = 0;

    for (const note of notes) {
      // ── Idempotency check ────────────────────────────────────────────────
      const metaRef = doc(db, `users/${uid}/clinical_notes/${note.id}`);
      const existing = await getDoc(metaRef);
      if (existing.exists()) {
        skipped++;
        continue;
      }

      // ── Extract attachment ───────────────────────────────────────────────
      const attachment = extractAttachment(note.fhirResource);
      const rawContentType = attachment?.contentType ?? 'application/xml';
      const contentType = ALLOWED_CONTENT_TYPES.has(rawContentType)
        ? rawContentType
        : 'application/octet-stream';
      let parsedSections: CdaSection[] = [];
      let parsedText: string = '';
      let parsedDocType: string = 'unknown';
      let storagePath: string | null = null;

      if (attachment?.data) {
        const uploadedPayload = await uploadParsedDocument(
          uid,
          note.id,
          note.displayName,
          note.fhirSourceURL,
          attachment.data,
          contentType,
        );
        parsedSections = uploadedPayload.parsedSections;
        parsedText = uploadedPayload.parsedText;
        parsedDocType = uploadedPayload.parsedDocType;
        storagePath = uploadedPayload.storagePath;
        console.log(
          `[ClinicalNotes] Uploaded ${storagePath} (docType=${parsedDocType}, sections=${parsedSections.length})`,
        );
        uploaded++;
      } else {
        if (__DEV__) {
          console.log(
            `[ClinicalNotes] Note ${note.id} ("${note.displayName}") has no inline data — metadata only`,
          );
        }
      }

      await writeClinicalNoteMetadata(metaRef, {
        displayName: note.displayName,
        startDate: note.startDate,
        endDate: note.endDate,
        title: attachment?.title ?? null,
        attachmentUrl: attachment?.url ?? null,
        fhirResourceType: note.fhirResourceType ?? null,
        fhirSourceURL: note.fhirSourceURL ?? null,
        contentType,
        parsedDocType,
        parsedText,
        parsedSections,
        storagePath,
      });
    }

    for (const sample of documentSamples) {
      const result = await syncDocumentSample(uid, sample);
      if (result.existed) {
        skipped++;
      } else if (result.uploaded) {
        uploaded++;
      }
    }

    console.log(
      `[ClinicalNotes] Sync complete — uploaded to Storage: ${uploaded}, already-existed (skipped): ${skipped}`,
    );
    return { ok: true, uploaded, skipped };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ClinicalNotes] syncClinicalNotes error:', message);
    return { ok: false, uploaded: 0, skipped: 0, error: message };
  }
}
