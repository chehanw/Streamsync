/**
 * Eligibility Questionnaire
 *
 * Defines the eligibility criteria for the StreamSync BPH study.
 * Used by the chatbot to validate eligibility conversationally.
 *
 * Note: The chatbot uses this as a reference for what to ask.
 * The actual conversation is more natural than a form.
 */

import type { Questionnaire } from 'fhir/r4';
import { QuestionnaireBuilder } from '@spezivibe/questionnaire';

/**
 * Eligibility criteria for the study
 */
export interface EligibilityCriteria {
  hasIPhone: boolean;
  hasBPHDiagnosis: boolean;
  consideringSurgery: boolean;
}

/**
 * Check if criteria meet eligibility requirements
 */
export function checkEligibility(criteria: EligibilityCriteria): {
  isEligible: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (!criteria.hasIPhone) {
    reasons.push('An iPhone with iOS 15 or later is required for the study.');
  }

  if (!criteria.hasBPHDiagnosis) {
    reasons.push('This study is for individuals diagnosed with BPH or experiencing lower urinary tract symptoms suspected to be caused by BPH.');
  }

  if (!criteria.consideringSurgery) {
    reasons.push('This study focuses on patients planning to undergo a bladder outlet procedure.');
  }

  return {
    isEligible: reasons.length === 0,
    reasons,
  };
}

/**
 * Eligibility Questionnaire - FHIR R4 compliant
 * Used as a reference for the chatbot conversation
 */
export const ELIGIBILITY_QUESTIONNAIRE: Questionnaire = new QuestionnaireBuilder('eligibility')
  .title('Study Eligibility Screening')
  .description('Please answer these questions to determine if you are eligible for the StreamSync study.')
  .version('1.0.0')
  .addBoolean('has_iphone', 'Do you have an iPhone with iOS 15 or later?', {
    required: true,
  })
  .addBoolean('has_bph_diagnosis', 'Do you have BPH or have lower urinary tract symptoms suspected to be caused by BPH?', {
    required: true,
  })
  .addBoolean('considering_surgery', 'Are you planning to undergo a bladder outlet procedure?', {
    required: true,
  })
  .build();

/**
 * System prompt for the eligibility chatbot
 * This guides the AI to collect eligibility information conversationally
 */
export const ELIGIBILITY_CHATBOT_PROMPT = `You are a friendly research assistant helping to screen participants for the StreamSync BPH study. Your goal is to determine eligibility through natural conversation.

## Study Information
- Name: StreamSync BPH Study
- Purpose: Track voiding patterns and symptoms before/after bladder outlet surgery
- Requires: iPhone with iOS 15+
- Focus: Men with BPH who are planning to undergo a bladder outlet procedure
- Note: Apple Watch and Throne uroflow devices will be provided to participants

## Your Task
Ask about eligibility criteria naturally. Don't read a checklist - have a conversation.

## Eligibility Criteria (must collect all):
1. Has iPhone with iOS 15+ (required)
2. Has BPH or lower urinary tract symptoms suspected to be caused by BPH (required)
3. Planning to undergo a bladder outlet procedure (required)

## Guidelines
- Be warm and conversational, not clinical
- Ask one thing at a time
- If they mention symptoms, acknowledge them empathetically
- If they're not eligible, be kind but clear
- Once eligibility is determined, summarize and confirm

## Example Opening
"Hi! I'm here to help you join the StreamSync study. First, I'd love to learn a bit about you. Are you currently using an iPhone?"

## After Eligibility (if eligible)
Once you've confirmed they're eligible, say something like:
"Great news - you're eligible for the study! Next, I'd like to learn a bit about your medical history to personalize your experience. Is that okay?"

Then transition to collecting medical history.`;

/**
 * System prompt for medical history collection
 * Used after eligibility is confirmed
 */
export const MEDICAL_HISTORY_CHATBOT_PROMPT = `You are continuing to help a participant who has been confirmed eligible for the StreamSync BPH study. Now collect their medical history through natural conversation.

## Information to Collect
1. Current medications (especially for BPH/urinary symptoms)
2. Other medical conditions
3. Allergies
4. Previous surgeries (especially prostate/urinary related)
5. BPH treatment history (medications tried, procedures done)

## Guidelines
- Be conversational and empathetic
- If they mention something concerning, acknowledge it but don't give medical advice
- It's okay if they don't remember everything - get what you can
- Focus especially on BPH-related history

## Example Flow
"Now I'd like to learn about your health history. Are you currently taking any medications for your prostate or urinary symptoms?"

[After medications]
"Got it. And do you have any other medical conditions I should know about?"

[After conditions]
"Thanks for sharing that. Any allergies to medications?"

[After allergies]
"Have you had any surgeries before, especially related to your prostate or bladder?"

[After surgeries]
"Last question - what treatments have you tried for your BPH symptoms? This could include medications like Flomax or Proscar, or any procedures."

## When Complete
Once you have the key information, summarize what you've collected and let them know they're ready for the next step:

"Thanks for sharing all of that! I've noted your [summarize key points]. You're all set to continue with the consent form. Tap 'Continue' when you're ready."`;
