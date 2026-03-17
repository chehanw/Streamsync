/**
 * Consent PDF Generation & Upload
 *
 * Builds an HTML consent document from the study's consent structure,
 * renders it to a PDF via expo-print, uploads the PDF bytes to Firebase
 * Storage, and records metadata in Firestore.
 *
 * Storage path:
 *   users/{uid}/consent_pdfs/consent_v{version}_{timestamp}.pdf
 *
 * Firestore path:
 *   users/{uid}/consent_response/current
 *
 * Failures are non-fatal: the caller should still proceed with onboarding
 * since consent is already recorded locally via ConsentService.
 */

import * as Print from 'expo-print';
import { getApp } from 'firebase/app';
import { getStorage, ref, uploadBytes } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { CONSENT_DOCUMENT } from '@/lib/consent/consent-document';
import { db, getAuth } from './firestore';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConsentSignatureData {
  signatureType: 'typed' | 'drawn';
  /** Full name typed by the participant, or null if they drew their signature. */
  participantName: string | null;
  /** The raw value passed to ConsentService.recordConsent — typed name or marker string. */
  signatureValue: string;
  /** ISO string of when the participant actually signed (may differ from upload time). */
  consentDate?: string;
}

export interface ConsentPdfResult {
  ok: boolean;
  storagePath?: string;
  error?: string;
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildConsentHtml(
  signature: ConsentSignatureData,
  consentDate: string,
): string {
  const sectionHtml = CONSENT_DOCUMENT.sections
    .map(
      s => `
      <div class="section">
        <h2>${s.title}</h2>
        <p>${s.content
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n/g, '<br/>')}</p>
      </div>`,
    )
    .join('');

  const signatureBlock =
    signature.signatureType === 'typed' && signature.participantName
      ? `<span class="sig-name">${signature.participantName}</span>`
      : `<span class="sig-drawn">[Drawn signature provided]</span>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #1a1a1a; margin: 40px; }
    h1 { font-size: 20px; text-align: center; margin-bottom: 4px; }
    .subtitle { text-align: center; color: #555; font-size: 13px; margin-bottom: 4px; }
    .meta { text-align: center; color: #777; font-size: 11px; margin-bottom: 24px; }
    hr { border: none; border-top: 1px solid #ccc; margin: 20px 0; }
    .section { margin-bottom: 20px; page-break-inside: avoid; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 6px; }
    p { line-height: 1.65; margin: 0; }
    .sig-block { margin-top: 36px; padding-top: 20px; border-top: 2px solid #1a1a1a; }
    .sig-label { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-bottom: 10px; }
    .sig-name { font-size: 22px; font-style: italic; font-family: Georgia, serif; }
    .sig-drawn { font-size: 14px; color: #555; font-style: italic; }
    .sig-meta { font-size: 11px; color: #777; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>${CONSENT_DOCUMENT.title.toUpperCase()}</h1>
  <div class="subtitle">${CONSENT_DOCUMENT.studyName}</div>
  <div class="meta">
    ${CONSENT_DOCUMENT.institution} &nbsp;&middot;&nbsp;
    PI: ${CONSENT_DOCUMENT.principalInvestigator} &nbsp;&middot;&nbsp;
    IRB: ${CONSENT_DOCUMENT.irbProtocol} &nbsp;&middot;&nbsp;
    Version: ${CONSENT_DOCUMENT.version}
  </div>
  <hr/>
  ${sectionHtml}
  <hr/>
  <div class="sig-block">
    <div class="sig-label">Participant Signature</div>
    <div>${signatureBlock}</div>
    <div class="sig-meta">Date signed: ${consentDate}</div>
    ${signature.participantName ? `<div class="sig-meta">Name: ${signature.participantName}</div>` : ''}
  </div>
</body>
</html>`;
}

// ── uploadConsentPdf ──────────────────────────────────────────────────────────

/**
 * Generates and uploads a signed consent PDF for the currently signed-in user.
 *
 * Call this after ConsentService.recordConsent() succeeds. Failures are
 * returned in the result object — callers should not throw on failure since
 * the local AsyncStorage record is the source of truth for gate-keeping.
 */
export async function uploadConsentPdf(
  signature: ConsentSignatureData,
): Promise<ConsentPdfResult> {
  const uid = getAuth().currentUser?.uid;
  if (!uid) {
    return { ok: false, error: 'no-auth: user is not signed in' };
  }

  const now = new Date();
  const signedAt = signature.consentDate ? new Date(signature.consentDate) : now;
  const consentDate = signedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const storagePath = `users/${uid}/consent_pdfs/consent_v${CONSENT_DOCUMENT.version}_${timestamp}.pdf`;

  try {
    // 1. Render HTML → local PDF file (no base64 — avoids RN ArrayBuffer/Blob issue)
    const html = buildConsentHtml(signature, consentDate);
    const { uri } = await Print.printToFileAsync({ html });

    // 2. Read the local file as a React Native Blob via fetch.
    //    RN's fetch handles file:// URIs natively and its blob() produces a
    //    native Blob that is compatible with Firebase Storage's uploadBytes.
    //    (uploadString+base64 internally creates Blob(ArrayBuffer) which RN rejects.)
    const response = await fetch(uri);
    const blob = await response.blob();

    // 3. Upload PDF to Firebase Storage
    const storageRef = ref(getStorage(getApp()), storagePath);
    await uploadBytes(storageRef, blob, {
      contentType: 'application/pdf',
      customMetadata: {
        uid,
        consentVersion: CONSENT_DOCUMENT.version,
        signatureType: signature.signatureType,
        participantName: signature.participantName ?? '',
        consentDate,
      },
    });

    console.log(`[ConsentPdf] Uploaded ${storagePath}`);

    // 3. Write metadata to Firestore (users/{uid}/consent_response/current)
    await setDoc(
      doc(db, `users/${uid}/consent_response/current`),
      {
        given: true,
        version: CONSENT_DOCUMENT.version,
        signatureType: signature.signatureType,
        participantName: signature.participantName ?? null,
        studyName: CONSENT_DOCUMENT.studyName,
        irbProtocol: CONSENT_DOCUMENT.irbProtocol,
        storagePath,
        consentTimestamp: now.toISOString(),
        recordedAt: serverTimestamp(),
      },
      { merge: false },
    );

    return { ok: true, storagePath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ConsentPdf] upload error:', message);
    return { ok: false, error: message };
  }
}
