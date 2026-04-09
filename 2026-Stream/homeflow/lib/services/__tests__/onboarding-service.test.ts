/**
 * Unit Tests for Onboarding Service
 *
 * The OnboardingService is a state machine that manages the multi-step
 * enrollment flow for the research study. It tracks which step the user
 * is on, stores collected data, and persists state so users can resume.
 *
 * Onboarding steps: WELCOME → CHAT → CONSENT → PERMISSIONS → MEDICAL_HISTORY → BASELINE_SURVEY → COMPLETE
 *
 * Key behaviors tested:
 * - State machine navigation (start, nextStep, goToStep, complete)
 * - Data collection and merging (updateData, getData)
 * - Progress tracking (getProgress, isComplete)
 * - State persistence and recovery
 * - Reset functionality for re-enrollment
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, OnboardingStep, ONBOARDING_FLOW } from '../../constants';

/**
 * Helper to create a fresh OnboardingService instance for each test.
 * Resets the module cache to clear the singleton state.
 */
const createOnboardingService = () => {
  jest.resetModules();
  const { OnboardingService } = require('../onboarding-service');
  return OnboardingService;
};

describe('OnboardingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: simulate empty storage (no prior onboarding)
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  /**
   * Tests for hasStarted()
   *
   * Determines if the user has begun the onboarding process.
   * Used to decide whether to show welcome screen vs resume.
   */
  describe('hasStarted', () => {
    /**
     * Verifies that a fresh app state (no stored step) correctly
     * reports that onboarding has not started.
     */
    it('should return false when onboarding has never been started', async () => {
      const service = createOnboardingService();
      const result = await service.hasStarted();
      expect(result).toBe(false);
    });

    /**
     * Verifies that when a step exists in storage, the service
     * correctly identifies that onboarding has started.
     */
    it('should return true when onboarding step exists in storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_STEP) return Promise.resolve(OnboardingStep.WELCOME);
        return Promise.resolve(null);
      });

      const service = createOnboardingService();
      const result = await service.hasStarted();
      expect(result).toBe(true);
    });
  });

  /**
   * Tests for getCurrentStep()
   *
   * Returns the current step in the onboarding flow.
   * Used by navigation to route to the correct screen.
   */
  describe('getCurrentStep', () => {
    /**
     * Verifies null is returned when onboarding hasn't started,
     * allowing callers to distinguish from valid step states.
     */
    it('should return null when onboarding has not started', async () => {
      const service = createOnboardingService();
      const result = await service.getCurrentStep();
      expect(result).toBeNull();
    });

    /**
     * Verifies the correct step is loaded from storage.
     */
    it('should return the step stored in AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_STEP) return Promise.resolve(OnboardingStep.CONSENT);
        return Promise.resolve(null);
      });

      const service = createOnboardingService();
      const result = await service.getCurrentStep();
      expect(result).toBe(OnboardingStep.CONSENT);
    });
  });

  /**
   * Tests for isComplete()
   *
   * Checks if the user has finished all onboarding steps.
   * Used by auth guards to allow access to the main app.
   */
  describe('isComplete', () => {
    /**
     * Verifies false when onboarding hasn't started.
     */
    it('should return false when onboarding has not started', async () => {
      const service = createOnboardingService();
      const result = await service.isComplete();
      expect(result).toBe(false);
    });

    /**
     * Verifies false when on an intermediate step (not COMPLETE).
     */
    it('should return false when on an intermediate step', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_STEP) return Promise.resolve(OnboardingStep.CONSENT);
        return Promise.resolve(null);
      });

      const service = createOnboardingService();
      const result = await service.isComplete();
      expect(result).toBe(false);
    });

    /**
     * Verifies true when the current step is COMPLETE.
     */
    it('should return true when step is COMPLETE', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_STEP) return Promise.resolve(OnboardingStep.COMPLETE);
        if (key === STORAGE_KEYS.ONBOARDING_FINISHED) return Promise.resolve('true');
        return Promise.resolve(null);
      });

      const service = createOnboardingService();
      const result = await service.isComplete();
      expect(result).toBe(true);
    });
  });

  /**
   * Tests for start()
   *
   * Initializes the onboarding flow from the beginning.
   * Sets the step to WELCOME and initializes empty data.
   */
  describe('start', () => {
    /**
     * Verifies that start() sets the step to WELCOME.
     */
    it('should set initial step to WELCOME', async () => {
      const service = createOnboardingService();
      await service.start();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.ONBOARDING_STEP,
        OnboardingStep.WELCOME
      );
    });

    /**
     * Verifies that start() initializes empty onboarding data.
     */
    it('should initialize with empty data object', async () => {
      const service = createOnboardingService();
      await service.start();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(STORAGE_KEYS.ONBOARDING_DATA, '{}');
    });

    /**
     * Verifies hasStarted() returns true after calling start().
     */
    it('should mark onboarding as started', async () => {
      const service = createOnboardingService();
      await service.start();

      const hasStarted = await service.hasStarted();
      expect(hasStarted).toBe(true);
    });
  });

  /**
   * Tests for nextStep()
   *
   * Advances to the next step in the ONBOARDING_FLOW array.
   * Auto-starts if not already started.
   */
  describe('nextStep', () => {
    /**
     * Verifies that calling nextStep() without starting first
     * automatically starts onboarding and returns WELCOME.
     */
    it('should auto-start onboarding if not started and return WELCOME', async () => {
      const service = createOnboardingService();
      const step = await service.nextStep();

      expect(step).toBe(OnboardingStep.WELCOME);
    });

    /**
     * Verifies correct progression through the flow:
     * WELCOME → CHAT
     */
    it('should advance from WELCOME to CHAT', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_STEP) return Promise.resolve(OnboardingStep.WELCOME);
        return Promise.resolve(null);
      });

      const service = createOnboardingService();
      const step = await service.nextStep();

      expect(step).toBe(OnboardingStep.CHAT);
    });

    /**
     * Verifies that calling nextStep() when already on COMPLETE
     * stays on COMPLETE (doesn't go out of bounds).
     */
    it('should stay on COMPLETE when already complete (boundary check)', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_STEP) return Promise.resolve(OnboardingStep.COMPLETE);
        return Promise.resolve(null);
      });

      const service = createOnboardingService();
      const step = await service.nextStep();

      expect(step).toBe(OnboardingStep.COMPLETE);
    });

    /**
     * Verifies that the new step is persisted to storage.
     */
    it('should persist the new step to AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_STEP) return Promise.resolve(OnboardingStep.WELCOME);
        return Promise.resolve(null);
      });

      const service = createOnboardingService();
      await service.nextStep();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.ONBOARDING_STEP,
        OnboardingStep.CHAT
      );
    });
  });

  /**
   * Tests for goToStep()
   *
   * Allows jumping to a specific step (e.g., for deep linking
   * or going back to fix earlier responses).
   */
  describe('goToStep', () => {
    /**
     * Verifies that a specific step can be set directly.
     */
    it('should set the specified step', async () => {
      const service = createOnboardingService();
      await service.goToStep(OnboardingStep.PERMISSIONS);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.ONBOARDING_STEP,
        OnboardingStep.PERMISSIONS
      );
    });

    /**
     * Verifies auto-start behavior when going to a step
     * before onboarding has been initialized.
     */
    it('should auto-start onboarding if not already started', async () => {
      const service = createOnboardingService();
      await service.goToStep(OnboardingStep.CONSENT);

      // Should have been started (check that setItem was called for step)
      const stepCalls = (AsyncStorage.setItem as jest.Mock).mock.calls.filter(
        (call) => call[0] === STORAGE_KEYS.ONBOARDING_STEP
      );
      expect(stepCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  /**
   * Tests for updateData()
   *
   * Merges new data into the onboarding data object.
   * Used to save responses from each step (eligibility, account, etc.).
   */
  describe('updateData', () => {
    /**
     * Verifies that data is merged into the existing state
     * (not replaced entirely).
     */
    it('should merge new data into existing state', async () => {
      const service = createOnboardingService();
      await service.start();

      await service.updateData({
        eligibility: {
          hasIPhone: true,
          hasBPHDiagnosis: true,
          consideringSurgery: true,
          isEligible: true,
        },
      });

      const data = await service.getData();
      expect(data.eligibility?.hasIPhone).toBe(true);
    });

    /**
     * Verifies auto-start when updating data before onboarding started.
     */
    it('should auto-start onboarding if not started when updating data', async () => {
      const service = createOnboardingService();

      await service.updateData({
        account: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
      });

      const hasStarted = await service.hasStarted();
      expect(hasStarted).toBe(true);
    });

    /**
     * Verifies that updated data is persisted to storage.
     */
    it('should persist updated data to AsyncStorage', async () => {
      const service = createOnboardingService();
      await service.start();
      (AsyncStorage.setItem as jest.Mock).mockClear();

      await service.updateData({
        account: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.ONBOARDING_DATA,
        expect.stringContaining('John')
      );
    });
  });

  /**
   * Tests for getData()
   *
   * Retrieves all collected onboarding data.
   */
  describe('getData', () => {
    /**
     * Verifies empty object returned when not started.
     */
    it('should return empty object when onboarding not started', async () => {
      const service = createOnboardingService();
      const data = await service.getData();
      expect(data).toEqual({});
    });

    /**
     * Verifies stored data is returned correctly.
     */
    it('should return data loaded from storage', async () => {
      const mockData = {
        account: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
      };
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_STEP) return Promise.resolve(OnboardingStep.CONSENT);
        if (key === STORAGE_KEYS.ONBOARDING_DATA) return Promise.resolve(JSON.stringify(mockData));
        return Promise.resolve(null);
      });

      const service = createOnboardingService();
      const data = await service.getData();
      expect(data).toEqual(mockData);
    });
  });

  /**
   * Tests for markIneligible()
   *
   * Sets eligibility.isEligible to false when the user fails
   * eligibility screening. Used to track ineligible participants.
   */
  describe('markIneligible', () => {
    /**
     * Verifies that markIneligible sets the isEligible flag to false.
     */
    it('should set eligibility.isEligible to false', async () => {
      const service = createOnboardingService();
      await service.start();
      await service.markIneligible();

      const data = await service.getData();
      expect(data.eligibility?.isEligible).toBe(false);
    });
  });

  /**
   * Tests for complete()
   *
   * Marks onboarding as finished by setting step to COMPLETE.
   */
  describe('complete', () => {
    /**
     * Verifies that complete() sets the step to COMPLETE.
     */
    it('should set step to COMPLETE', async () => {
      const service = createOnboardingService();
      await service.start();
      await service.complete();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.ONBOARDING_STEP,
        OnboardingStep.COMPLETE
      );
    });

    /**
     * Verifies isComplete() returns true after calling complete().
     */
    it('should report isComplete as true after completion', async () => {
      const service = createOnboardingService();
      await service.start();
      await service.complete();

      const isComplete = await service.isComplete();
      expect(isComplete).toBe(true);
    });
  });

  /**
   * Tests for reset()
   *
   * Clears all onboarding state for re-enrollment or testing.
   * Removes step, data, and related keys (consent, permissions, etc.).
   */
  describe('reset', () => {
    /**
     * Verifies that reset() removes all onboarding-related keys
     * from AsyncStorage in a single multiRemove call.
     */
    it('should remove all onboarding-related keys from storage', async () => {
      const service = createOnboardingService();
      await service.start();
      await service.reset();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
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
    });

    /**
     * Verifies hasStarted() returns false after reset.
     */
    it('should report as not started after reset', async () => {
      const service = createOnboardingService();
      await service.start();
      await service.reset();

      // Simulate cleared storage
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const hasStarted = await service.hasStarted();
      expect(hasStarted).toBe(false);
    });
  });

  /**
   * Tests for getNextStepName()
   *
   * Returns the next step in the flow without advancing.
   * Useful for showing "Next: ..." previews in the UI.
   * Note: This is a synchronous method that reads from in-memory state.
   */
  describe('getNextStepName', () => {
    /**
     * Verifies WELCOME is returned when state is null (not started).
     */
    it('should return WELCOME when onboarding not started', () => {
      const service = createOnboardingService();
      const next = service.getNextStepName();
      expect(next).toBe(OnboardingStep.WELCOME);
    });
  });

  /**
   * Tests for getProgress()
   *
   * Returns the completion percentage (0-100) based on current step.
   * Note: This is a synchronous method that reads from in-memory state.
   */
  describe('getProgress', () => {
    /**
     * Verifies 0% progress when not started.
     */
    it('should return 0 when onboarding not started', () => {
      const service = createOnboardingService();
      const progress = service.getProgress();
      expect(progress).toBe(0);
    });

    /**
     * Verifies correct percentage calculation for intermediate step.
     */
    it('should return correct percentage for current step', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_STEP) return Promise.resolve(OnboardingStep.CONSENT);
        return Promise.resolve(null);
      });

      const service = createOnboardingService();
      // Must initialize to load state from storage
      await service.initialize();

      const progress = service.getProgress();
      // CONSENT is index 2 in a 7-step flow (indices 0-6)
      // Progress = (2 / 6) * 100 = 33%
      const expectedIndex = ONBOARDING_FLOW.indexOf(OnboardingStep.CONSENT);
      const expectedProgress = Math.round((expectedIndex / (ONBOARDING_FLOW.length - 1)) * 100);
      expect(progress).toBe(expectedProgress);
    });

    /**
     * Verifies 100% progress when complete.
     */
    it('should return 100 when on COMPLETE step', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.ONBOARDING_STEP) return Promise.resolve(OnboardingStep.COMPLETE);
        return Promise.resolve(null);
      });

      const service = createOnboardingService();
      await service.initialize();

      const progress = service.getProgress();
      expect(progress).toBe(100);
    });
  });

  /**
   * Tests for error handling
   */
  describe('error handling', () => {
    /**
     * Verifies graceful handling of storage errors during initialization.
     */
    it('should handle storage errors gracefully during initialization', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const service = createOnboardingService();
      const step = await service.getCurrentStep();

      // Should complete without throwing, returning null
      expect(step).toBeNull();
    });
  });
});
