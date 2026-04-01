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
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Share, Linking } from 'react-native';

import { CONSENT_DOCUMENT } from '@/lib/consent/consent-document';
import { db, getAuth } from './firestore';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConsentSignatureData {
  signatureType: 'typed' | 'drawn';
  /** Full name typed by the participant. */
  participantName: string;
  /** The typed signature value or a marker for a drawn signature. */
  signatureValue: string;
  /** ISO string of when the participant actually signed (may differ from upload time). */
  consentDate?: string;
  /** Inline SVG markup of the drawn signature when signatureType === 'drawn'. */
  drawnSignatureSvg?: string | null;
}

export interface ConsentPdfResult {
  ok: boolean;
  storagePath?: string;
  downloadUrl?: string;
  error?: string;
}

export interface SavedConsentPdfMetadata {
  storagePath: string;
  signatureType: 'typed' | 'drawn';
  participantName: string;
  consentTimestamp: string;
  consentDateLabel?: string;
  consentTimeLabel?: string;
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildConsentHtml(
  signature: ConsentSignatureData,
  consentDate: string,
  consentTime: string,
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
    signature.signatureType === 'drawn' && signature.drawnSignatureSvg
      ? `<div class="sig-drawn-wrap">${signature.drawnSignatureSvg}</div>`
      : `<span class="sig-name">${signature.signatureValue}</span>`;

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
    .sig-drawn-wrap { width: 240px; height: 100px; }
    .sig-drawn-wrap svg { width: 240px; height: 100px; display: block; }
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
    <div class="sig-meta">Time signed: ${consentTime}</div>
    <div class="sig-meta">Name: ${signature.participantName}</div>
  </div>
</body>
</html>`;
}

async function getSavedConsentPdfMetadata(
  uid: string,
): Promise<SavedConsentPdfMetadata | null> {
  const snapshot = await getDoc(doc(db, `users/${uid}/consent_response/current`));
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as Partial<SavedConsentPdfMetadata> & {
    storagePath?: string;
  };
  if (!data.storagePath || !data.participantName || !data.signatureType || !data.consentTimestamp) {
    return null;
  }

  return {
    storagePath: data.storagePath,
    signatureType: data.signatureType,
    participantName: data.participantName,
    consentTimestamp: data.consentTimestamp,
    consentDateLabel: data.consentDateLabel,
    consentTimeLabel: data.consentTimeLabel,
  };
}

export async function getSavedConsentPdfDownloadUrl(): Promise<string | null> {
  const uid = getAuth().currentUser?.uid;
  if (!uid) {
    return null;
  }

  const metadata = await getSavedConsentPdfMetadata(uid);
  if (!metadata) {
    return null;
  }

  return getDownloadURL(ref(getStorage(getApp()), metadata.storagePath));
}

export async function shareSavedConsentPdf(): Promise<boolean> {
  const downloadUrl = await getSavedConsentPdfDownloadUrl();
  if (!downloadUrl) {
    return false;
  }

  await Share.share({
    title: `${CONSENT_DOCUMENT.title} – ${CONSENT_DOCUMENT.studyName}`,
    url: downloadUrl,
    message: `Signed consent form for ${CONSENT_DOCUMENT.studyName}`,
  });

  return true;
}

export async function openSavedConsentPdf(): Promise<boolean> {
  const downloadUrl = await getSavedConsentPdfDownloadUrl();
  if (!downloadUrl) {
    return false;
  }

  await Linking.openURL(downloadUrl);
  return true;
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
  const consentTime = signedAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const storagePath = `users/${uid}/consent_pdfs/consent_v${CONSENT_DOCUMENT.version}_${timestamp}.pdf`;

  try {
    // 1. Render HTML → local PDF file (no base64 — avoids RN ArrayBuffer/Blob issue)
    const html = buildConsentHtml(signature, consentDate, consentTime);
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
        participantName: signature.participantName,
        consentDate,
        consentTime,
      },
    });

    console.log(`[ConsentPdf] Uploaded ${storagePath}`);

    const downloadUrl = await getDownloadURL(storageRef);

    // 3. Write metadata to Firestore (users/{uid}/consent_response/current)
    await setDoc(
      doc(db, `users/${uid}/consent_response/current`),
      {
        given: true,
        version: CONSENT_DOCUMENT.version,
        signatureType: signature.signatureType,
        participantName: signature.participantName,
        signatureValue: signature.signatureValue,
        studyName: CONSENT_DOCUMENT.studyName,
        irbProtocol: CONSENT_DOCUMENT.irbProtocol,
        storagePath,
        downloadUrl,
        consentTimestamp: signedAt.toISOString(),
        consentDateLabel: consentDate,
        consentTimeLabel: consentTime,
        recordedAt: serverTimestamp(),
      },
      { merge: false },
    );

    return { ok: true, storagePath, downloadUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ConsentPdf] upload error:', message);
    return { ok: false, error: message };
  }
}
