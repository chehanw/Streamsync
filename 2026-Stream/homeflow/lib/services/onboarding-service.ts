/**
 * Onboarding Service
 *
 * State machine for managing onboarding flow progress.
 * Persists state to AsyncStorage so users can resume from any step.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, OnboardingStep, ONBOARDING_FLOW } from '../constants';

/**
 * Data collected during onboarding
 */
export interface OnboardingData {
  // Eligibility responses (from chatbot)
  eligibility?: {
    hasIPhone: boolean;
    hasBPHDiagnosis: boolean;
    consideringSurgery: boolean;
    isEligible: boolean;
    /** YYYY-MM-DD string of the scheduled surgery date, if provided */
    surgeryDate?: string;
  };

  // Medical history (from chatbot)
  medicalHistory?: {
    medications: string[];
    conditions: string[];
    allergies: string[];
    surgicalHistory: string[];
    bphTreatmentHistory: string[];
    rawTranscript?: string; // Full chat transcript for reference
  };

  // Account info
  account?: {
    firstName: string;
    lastName: string;
    email: string;
    dateOfBirth?: string;
  };

  // Permissions status
  permissions?: {
    healthKit: 'granted' | 'denied' | 'not_determined';
    clinicalRecords: 'granted' | 'denied' | 'not_determined' | 'skipped';
    throne: 'granted' | 'denied' | 'not_determined' | 'skipped';
  };

  // Consent PDF — stored pre-auth, uploaded to Firebase Storage after sign-in
  pendingConsentPdf?: {
    signatureType: 'typed' | 'drawn';
    participantName: string | null;
    signatureValue: string;
    consentDate: string; // ISO string
  };

  // IPSS baseline score
  ipssBaseline?: {
    score: number;
    qolScore: number;
    completedAt: string;
    responseId: string;
  };
}

/**
 * Onboarding state stored in AsyncStorage
 */
interface OnboardingState {
  currentStep: OnboardingStep;
  data: OnboardingData;
  startedAt: string;
  lastUpdatedAt: string;
}

class OnboardingServiceImpl {
  private state: OnboardingState | null = null;
  private initialized = false;
  private finished = false;

  /**
   * Initialize the service by loading state from AsyncStorage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const stepData = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_STEP);
      const savedData = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_DATA);
      const finishedData = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_FINISHED);

      if (stepData) {
        this.state = {
          currentStep: stepData as OnboardingStep,
          data: savedData ? JSON.parse(savedData) : {},
          startedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
        };
      }

      this.finished = finishedData === 'true';
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize onboarding service:', error);
      this.initialized = true;
    }
  }

  /**
   * Get the current onboarding step
   */
  async getCurrentStep(): Promise<OnboardingStep | null> {
    await this.initialize();
    return this.state?.currentStep ?? null;
  }

  /**
   * Check if onboarding is complete (user clicked "Get Started")
   */
  async isComplete(): Promise<boolean> {
    await this.initialize();
    return this.finished;
  }

  /**
   * Check if onboarding has been started
   */
  async hasStarted(): Promise<boolean> {
    await this.initialize();
    return this.state !== null;
  }

  /**
   * Start onboarding from the beginning
   */
  async start(): Promise<void> {
    const now = new Date().toISOString();
    this.state = {
      currentStep: OnboardingStep.WELCOME,
      data: {},
      startedAt: now,
      lastUpdatedAt: now,
    };
    await this.persistState();
  }

  /**
   * Move to the next step in the flow
   */
  async nextStep(): Promise<OnboardingStep> {
    await this.initialize();

    if (!this.state) {
      await this.start();
      return OnboardingStep.WELCOME;
    }

    const currentIndex = ONBOARDING_FLOW.indexOf(this.state.currentStep);
    const nextIndex = Math.min(currentIndex + 1, ONBOARDING_FLOW.length - 1);
    const nextStep = ONBOARDING_FLOW[nextIndex];

    this.state.currentStep = nextStep;
    this.state.lastUpdatedAt = new Date().toISOString();
    await this.persistState();

    return nextStep;
  }

  /**
   * Go to a specific step (for navigation)
   */
  async goToStep(step: OnboardingStep): Promise<void> {
    await this.initialize();

    if (!this.state) {
      await this.start();
    }

    this.state!.currentStep = step;
    this.state!.lastUpdatedAt = new Date().toISOString();
    await this.persistState();
  }

  /**
   * Update onboarding data
   */
  async updateData(data: Partial<OnboardingData>): Promise<void> {
    await this.initialize();

    if (!this.state) {
      await this.start();
    }

    this.state!.data = { ...this.state!.data, ...data };
    this.state!.lastUpdatedAt = new Date().toISOString();
    await this.persistState();
  }

  /**
   * Get all collected onboarding data
   */
  async getData(): Promise<OnboardingData> {
    await this.initialize();
    return this.state?.data ?? {};
  }

  /**
   * Mark user as ineligible and stop onboarding
   */
  async markIneligible(): Promise<void> {
    await this.initialize();

    if (this.state) {
      this.state.data.eligibility = {
        ...this.state.data.eligibility,
        isEligible: false,
      } as OnboardingData['eligibility'];
      await this.persistState();
    }
  }

  /**
   * Complete onboarding (called when user clicks "Get Started")
   */
  async complete(): Promise<void> {
    await this.initialize();

    if (this.state) {
      this.state.currentStep = OnboardingStep.COMPLETE;
      this.state.lastUpdatedAt = new Date().toISOString();
      await this.persistState();
    }

    // Mark onboarding as finished (distinct from reaching the complete screen)
    this.finished = true;
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_FINISHED, 'true');
  }

  /**
   * Reset onboarding (for testing or re-enrollment)
   */
  async reset(): Promise<void> {
    this.state = null;
    this.initialized = false;
    this.finished = false;

    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ONBOARDING_STEP,
      STORAGE_KEYS.ONBOARDING_DATA,
      STORAGE_KEYS.ONBOARDING_FINISHED,
      STORAGE_KEYS.CONSENT_GIVEN,
      STORAGE_KEYS.CONSENT_DATE,
      STORAGE_KEYS.CONSENT_VERSION,
      STORAGE_KEYS.MEDICAL_HISTORY,
      STORAGE_KEYS.ELIGIBILITY_RESPONSES,
      STORAGE_KEYS.IPSS_BASELINE,
      STORAGE_KEYS.PERMISSIONS_STATUS,
    ]);
  }

  /**
   * Get the step after the current one (for preview)
   */
  getNextStepName(): OnboardingStep | null {
    if (!this.state) return OnboardingStep.WELCOME;

    const currentIndex = ONBOARDING_FLOW.indexOf(this.state.currentStep);
    if (currentIndex >= ONBOARDING_FLOW.length - 1) return null;

    return ONBOARDING_FLOW[currentIndex + 1];
  }

  /**
   * Get progress as a percentage
   */
  getProgress(): number {
    if (!this.state) return 0;

    const currentIndex = ONBOARDING_FLOW.indexOf(this.state.currentStep);
    return Math.round((currentIndex / (ONBOARDING_FLOW.length - 1)) * 100);
  }

  /**
   * Persist state to AsyncStorage
   */
  private async persistState(): Promise<void> {
    if (!this.state) return;

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_STEP, this.state.currentStep);
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_DATA, JSON.stringify(this.state.data));
    } catch (error) {
      console.error('Failed to persist onboarding state:', error);
    }
  }
}

/**
 * Singleton instance of the onboarding service
 */
export const OnboardingService = new OnboardingServiceImpl();
