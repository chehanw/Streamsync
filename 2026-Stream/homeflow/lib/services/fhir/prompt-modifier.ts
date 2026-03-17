/**
 * Prompt Modifier
 *
 * Generates a modified system prompt for the medical history chatbot
 * that tells it which fields are already known from health records,
 * so it only asks about gaps.
 */

import type { MedicalHistoryPrefill } from './types';
import { getMissingFields, getKnownFieldsSummary } from './prefill-builder';
import { STUDY_INFO } from '@/lib/constants';

/**
 * Build a modified system prompt that incorporates known health record data.
 * The chatbot will confirm high-confidence items briefly and focus on gaps.
 */
export function buildModifiedSystemPrompt(
  prefill: MedicalHistoryPrefill,
  baseStudyInfo?: { name: string; institution: string },
): string {
  const study = baseStudyInfo ?? STUDY_INFO;
  const known = getKnownFieldsSummary(prefill);
  const missing = getMissingFields(prefill);

  const knownSection = known.length > 0
    ? known.map((item) => `- ${item}`).join('\n')
    : '(No health records data available)';

  const missingList = missing.map((field) => {
    switch (field) {
      case 'fullName': return 'Full name (for study records)';
      case 'ethnicity': return 'Ethnicity (Hispanic/Latino or Not)';
      case 'race': return 'Race';
      case 'age': return 'Age / Date of Birth';
      case 'biologicalSex': return 'Biological Sex';
      case 'medications': return 'BPH/LUTS Medications (alpha blockers, 5-ARIs, anticholinergics, beta-3 agonists)';
      case 'surgicalHistory': return 'Surgical History (BPH and general)';
      case 'psa': return 'PSA level (most recent)';
      case 'hba1c': return 'HbA1c level';
      case 'urinalysis': return 'Urinalysis results';
      case 'conditions': return 'Medical conditions (diabetes, hypertension, etc.)';
      case 'clinicalMeasurements': return 'Clinical measurements (PVR, clinic uroflow, mobility)';
      case 'upcomingSurgery': return 'Upcoming surgery details (date and type)';
      default: return field;
    }
  });

  return `You are a friendly research assistant collecting medical history for the ${study.name} study at ${study.institution}. The participant has already been confirmed eligible and has given informed consent.

## Pre-filled Data from Health Records

We already have the following information from the participant's Apple Health records. You do NOT need to ask about these, but you may briefly confirm them:

${knownSection}

## What You Still Need to Collect

Focus your questions on these missing fields:
${missingList.map((item) => `- ${item}`).join('\n')}

## Conversation Guidelines
- Be warm, conversational, and empathetic
- Start by briefly acknowledging what we already know from their health records
- Ask 2-3 related items at a time, don't overwhelm
- Group questions logically
- If they don't know a value (like PSA or HbA1c), that's OK - note "unknown" and continue
- NEVER give medical advice or interpret their values

## Important Response Markers
When ALL medical history sections are complete: [HISTORY_COMPLETE]

## Start the Conversation
"Thanks for completing the consent process! I can see some of your health information has already been pulled from your Apple Health records${known.length > 0 ? ' - I have your ' + summarizeKnownBriefly(known) : ''}. I just need to ask about a few more things to complete your medical history.

Let's start with some basic demographics - could you tell me your full name?"`;
}

function summarizeKnownBriefly(known: string[]): string {
  if (known.length === 0) return '';
  if (known.length <= 2) return known.join(' and ');
  return `${known.slice(0, 2).join(', ')}, and ${known.length - 2} more item${known.length - 2 > 1 ? 's' : ''}`;
}
