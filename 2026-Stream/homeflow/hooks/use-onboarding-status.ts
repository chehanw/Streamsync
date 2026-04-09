/**
 * Onboarding status hook
 *
 * Provides real-time onboarding status for navigation guards
 * and UI components.
 */

import { useState, useEffect, useCallback } from 'react';
import { OnboardingService } from '@/lib/services/onboarding-service';
import { OnboardingStep } from '@/lib/constants';

/**
 * Simple event emitter for onboarding status changes
 */
type StatusListener = () => void;
const statusListeners: Set<StatusListener> = new Set();

export function notifyOnboardingComplete(): void {
  statusListeners.forEach((listener) => listener());
}

/**
 * Hook that returns onboarding completion status
 * Returns null while loading, true if complete, false if not
 */
export function useOnboardingStatus(): boolean | null {
  const [status, setStatus] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      const isComplete = await OnboardingService.isComplete();
      if (!cancelled) {
        setStatus(isComplete);
      }
    }

    checkStatus();

    // Listen for status changes
    const listener = () => {
      checkStatus();
    };
    statusListeners.add(listener);

    return () => {
      cancelled = true;
      statusListeners.delete(listener);
    };
  }, []);

  return status;
}

/**
 * Hook that returns the current onboarding step
 */
export function useOnboardingStep(): OnboardingStep | null {
  const [step, setStep] = useState<OnboardingStep | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function getStep() {
      const currentStep = await OnboardingService.getCurrentStep();
      if (!cancelled) {
        setStep(currentStep);
      }
    }

    getStep();

    return () => {
      cancelled = true;
    };
  }, []);

  return step;
}

/**
 * Hook that provides onboarding navigation controls
 */
export function useOnboardingNavigation() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const step = await OnboardingService.getCurrentStep();
      if (!cancelled) {
        setCurrentStep(step);
        setIsLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  const nextStep = useCallback(async () => {
    setIsLoading(true);
    const next = await OnboardingService.nextStep();
    setCurrentStep(next);
    setIsLoading(false);
    return next;
  }, []);

  const goToStep = useCallback(async (step: OnboardingStep) => {
    setIsLoading(true);
    await OnboardingService.goToStep(step);
    setCurrentStep(step);
    setIsLoading(false);
  }, []);

  const complete = useCallback(async () => {
    setIsLoading(true);
    await OnboardingService.complete();
    setCurrentStep(OnboardingStep.COMPLETE);
    setIsLoading(false);
  }, []);

  const getProgress = useCallback(() => {
    return OnboardingService.getProgress();
  }, []);

  return {
    currentStep,
    isLoading,
    nextStep,
    goToStep,
    complete,
    getProgress,
  };
}

/**
 * Mark onboarding as completed
 */
export async function markOnboardingCompleted(): Promise<void> {
  await OnboardingService.complete();
}

/**
 * Reset onboarding status (for testing)
 */
export async function resetOnboardingStatus(): Promise<void> {
  await OnboardingService.reset();
}
