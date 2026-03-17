/**
 * Shared application-wide constants
 */

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  // Onboarding
  ONBOARDING_STEP: '@homeflow_onboarding_step',
  ONBOARDING_DATA: '@homeflow_onboarding_data',
  ONBOARDING_FINISHED: '@homeflow_onboarding_finished',

  // Consent
  CONSENT_GIVEN: '@homeflow_consent_given',
  CONSENT_DATE: '@homeflow_consent_date',
  CONSENT_VERSION: '@homeflow_consent_version',

  // Account
  ACCOUNT_PROFILE: '@homeflow_account_profile',

  // Medical history (collected via chatbot)
  MEDICAL_HISTORY: '@homeflow_medical_history',

  // Eligibility
  ELIGIBILITY_RESPONSES: '@homeflow_eligibility_responses',

  // IPSS scores
  IPSS_BASELINE: '@homeflow_ipss_baseline',
  IPSS_1_MONTH: '@homeflow_ipss_1month',
  IPSS_2_MONTH: '@homeflow_ipss_2month',
  IPSS_3_MONTH: '@homeflow_ipss_3month',

  // Permissions
  PERMISSIONS_STATUS: '@homeflow_permissions_status',

  // Notification tracking (last time we fired each reminder, to avoid spam)
  LAST_NOTIFICATION_HEALTHKIT: '@homeflow_last_notification_healthkit',
  LAST_NOTIFICATION_THRONE: '@homeflow_last_notification_throne',

  // One-time surgery complete modal (shown first time surgery date has passed)
  SURGERY_MODAL_SHOWN: '@homeflow_surgery_modal_shown',
} as const;

// Legacy keys for backwards compatibility
export const ONBOARDING_COMPLETED_KEY = '@onboarding_completed';
export const CONSENT_KEY = '@consent_given';

/**
 * Onboarding steps - defines the flow order
 */
export enum OnboardingStep {
  WELCOME = 'welcome',
  CHAT = 'chat', // Eligibility screening
  CONSENT = 'consent',
  ACCOUNT = 'account',
  PERMISSIONS = 'permissions',
  MEDICAL_HISTORY = 'medical_history', // Medical history collection (chatbot)
  BASELINE_SURVEY = 'baseline_survey',
  COMPLETE = 'complete',
}

/**
 * Ordered array of onboarding steps for navigation
 */
export const ONBOARDING_FLOW: OnboardingStep[] = [
  OnboardingStep.WELCOME,
  OnboardingStep.CHAT,
  OnboardingStep.CONSENT,
  OnboardingStep.ACCOUNT,
  OnboardingStep.PERMISSIONS,
  OnboardingStep.MEDICAL_HISTORY,
  OnboardingStep.BASELINE_SURVEY,
  OnboardingStep.COMPLETE,
];

/**
 * FHIR identifier system for task IDs
 */
export const SPEZIVIBE_TASK_ID_SYSTEM = 'http://spezivibe.com/fhir/identifier/task-id';

/**
 * Consent document version - increment when consent text changes
 */
export const CONSENT_VERSION = '1.0.0';

/**
 * Dev-only Firebase UID for testing Firestore queries without Apple Sign-In.
 * Used as uid fallback when DEV_BYPASS_AUTH is active and no user is signed in.
 */
export const DEV_FIREBASE_UID = 'REDACTED_UID';

/**
 * Demo UID used for Throne uroflow data reads across all devices.
 * All testers share this single Throne-linked account for the demo.
 */
export const DEMO_THRONE_UID = 'CUziuLyPtDNO2IvSbsifXPKrNEk2';

/**
 * Study information
 */
export const STUDY_INFO = {
  name: 'StreamSync BPH Study',
  institution: 'Stanford University',
  principalInvestigator: 'Ryan Sun, MD',
  irbProtocol: 'IRB# [TODO: fill in]', // TODO: replace with actual IRB approval number
  contactEmail: 'info@streamsyncresearch.com',
  contactPhone: '713-677-1764',
} as const;
