# HomeFlow

A research app for Stanford's CS342 — Building for Digital Health. HomeFlow helps men with BPH (benign prostatic hyperplasia) passively track their voiding patterns, sleep, and activity before and after bladder outlet surgery, so researchers can actually measure whether surgery works in the real world — not just in a clinic.

Built by Stream Team (Team 3).

---

## What it does

Right now, when a patient has prostate surgery, the main outcome measure is a questionnaire they fill out in a waiting room. HomeFlow replaces that with continuous, passive data collection at home using hardware and sensors the patient already has.

Concretely, it:

- Records every void using a **Throne uroflow device** attached to the patient's toilet, capturing flow rate, volume, and flow curve shape
- Pulls **activity, sleep, and heart rate** data from Apple Watch and HealthKit automatically, once per day
- Collects a **baseline IPSS symptom score** at enrollment and follow-up scores at 1 and 12 weeks post-surgery
- Walks patients through **enrollment and informed consent** entirely in-app, with a signed PDF stored securely
- Syncs everything to a **Firebase backend** for the research team to analyze

The patient doesn't need to do anything after setup. The app runs in the background.

---

## The patient journey

```
Download app
    ↓
Eligibility screening (takes ~2 min)
    ↓
Informed consent + digital signature
    ↓
Create account
    ↓
Grant HealthKit + Throne permissions
    ↓
Medical history review (pre-filled from Apple Health)
    ↓
Baseline IPSS survey
    ↓
Done — passive collection starts
    ↓
Follow-up IPSS at 1 week and 12 weeks post-surgery
```

---

## Tech stack

| Layer | What we use |
|---|---|
| App framework | React Native + Expo 54, TypeScript |
| Navigation | Expo Router (file-based) |
| Uroflow data | Throne API |
| Health data | Apple HealthKit + Apple Watch |
| Clinical records | Apple Health FHIR (CDA/HL7 XML, parsed on-device) |
| Backend | Firebase (Firestore + Storage + Cloud Functions) |
| Auth | Firebase Auth (Apple Sign In) |
| Forms | Formik + Yup |
| Surveys | Custom IPSS questionnaire component |

---

## Project structure

```
homeflow/
  app/
    (onboarding)/     # Enrollment flow: welcome → eligibility → consent → account → permissions → medical history → survey
    (tabs)/           # Main app: home, voiding log, profile
    _layout.tsx       # Root layout, auth guards, provider hierarchy

  src/services/
    clinicalNotesSync.ts    # HealthKit FHIR clinical notes → parse CDA XML → Firebase Storage + Firestore
    consentPdfSync.ts       # Generate signed consent PDF → Firebase Storage
    healthkitSync.ts        # Activity, sleep, HRV → Firestore
    throneFirestore.ts      # Throne session/metric reads + medical history writes
    cdaParser.ts            # Decode and parse HL7 CDA XML from Apple Health

  lib/
    services/         # HealthKit client, consent service, onboarding state
    consent/          # IRB consent document content
    questionnaires/   # IPSS and eligibility questionnaire definitions

  components/
    ui/               # SignaturePad, icons, shared primitives
    onboarding/       # Progress bar, consent agreement, continue button

  functions/          # Firebase Cloud Functions (Throne data ingestion)
```

---

## Getting started

You'll need:
- macOS with Xcode installed
- A physical iPhone (HealthKit does not work on simulators)
- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- A `.env` file with the keys below (ask a teammate)

```bash
# Install dependencies
cd homeflow && npm install

# Start the dev server
npx expo start

# Run on physical device (replace UDID with yours)
npx expo run:ios --device YOUR_DEVICE_UDID

# Run tests
npm test

# Deploy Firestore rules
firebase deploy --only firestore

# Deploy Storage rules
firebase deploy --only storage

# Deploy Cloud Functions
firebase deploy --only functions
```

### Environment variables

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_BACKEND_TYPE=firebase
THRONE_BASE_URL=
THRONE_API_KEY=
THRONE_TIMEZONE=
STUDY_ID=
```

> `THRONE_API_KEY` is server-side only — it lives in Cloud Functions and never reaches the client bundle.

---

## Data model

Everything in Firestore is scoped under `users/{uid}/`:

| Collection | What's in it |
|---|---|
| `throne_sessions/` | Void events from the Throne device (written by Cloud Function) |
| `throne_metrics/` | Flow rate curves per session |
| `hk_stepCount/` | Daily step counts from HealthKit |
| `hk_sleepAnalysis/` | Sleep stages and duration |
| `hk_heartRate/` | Heart rate samples |
| `hk_heartRateVariabilitySDNN/` | HRV samples |
| `medical_history/current` | Confirmed demographics, medications, conditions, procedures |
| `medical_history_prefill/latest` | FHIR-parsed pre-fill from Apple Health (read-only to user) |
| `clinical_notes/` | CDA XML notes from Apple Health, parsed to readable text |
| `surgery_date/current` | Patient's scheduled surgery date |
| `consent_response/current` | Consent record + storage path of signed PDF |

Firebase Storage holds:
- `users/{uid}/consent_pdfs/` — signed consent PDFs
- `users/{uid}/clinical_notes/` — raw decoded CDA XML for the MedGemma research pipeline

---

## A few things worth knowing

**Clinical notes come as HL7 CDA XML, not PDFs.** Apple Health delivers clinical documents as base64-encoded CDA XML. We parse them on-device into human-readable sections and store both the parsed text (in Firestore, for the app) and the raw XML (in Storage, for the research pipeline).

**Consent is recorded in two places.** The local AsyncStorage entry is the fast gate-keeper (used to block/allow onboarding steps). The Firebase record + signed PDF is the durable IRB audit trail.

**The Throne API key never touches the client.** All Throne API calls go through a Cloud Function. The client only reads from Firestore.

**Background sync doesn't require the app to be open.** HealthKit background delivery is registered at onboarding completion. The app wakes up to sync data once per day even if the patient never opens it.

**This is a research prototype.** Some stubs exist. Demo-safe fallbacks are in place when Throne hardware isn't available. Data is not used for clinical care.

---

## Team

Stream Team (Team 3) — Stanford CS342, Winter 2026

Principal Investigator: Ryan Sun, MD
IRB Protocol: IRB# -----
Contact: homeflow-study@stanford.edu
