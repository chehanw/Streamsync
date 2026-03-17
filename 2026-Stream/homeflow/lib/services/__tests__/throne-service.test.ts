/**
 * Unit Tests for Throne Service (Stubbed Implementation)
 *
 * The ThroneService provides integration with Throne uroflowmetry devices.
 * This is a STUB implementation for the MVP - it simulates the OAuth flow
 * and device connection without actual hardware/API integration.
 *
 * Note: These tests verify the stub behavior. When real Throne API
 * integration is added, these tests should be updated or extended.
 *
 * Key behaviors tested:
 * - Permission status tracking (not_determined → granted/skipped)
 * - Simulated OAuth permission request flow
 * - Connection status based on permission state
 * - Empty data returns (stub returns no mock measurements)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../constants';

/**
 * FEATURE FLAGS
 *
 * Set these to true when the corresponding feature is implemented.
 * Tests marked with these flags verify stub behavior and should be
 * updated when real implementation is added.
 */
const FEATURE_FLAGS = {
  /**
   * Set to true when real Throne API integration is implemented.
   * When true, tests should expect actual OAuth flow and real data.
   */
  THRONE_API_IMPLEMENTED: false,
};

/**
 * Helper to create fresh ThroneService instance for each test.
 */
const createThroneService = () => {
  jest.resetModules();
  const { ThroneService, isThroneAvailable } = require('../throne-service');
  return { ThroneService, isThroneAvailable };
};

describe('ThroneService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    // Use fake timers to control the simulated API delay
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Tests for getPermissionStatus()
   *
   * Returns the current Throne permission status:
   * - 'not_determined': User hasn't been asked yet
   * - 'granted': User authorized Throne access
   * - 'denied': User rejected authorization
   * - 'skipped': User chose to skip setup (can connect later)
   */
  describe('getPermissionStatus', () => {
    /**
     * Verifies default state is 'not_determined' for new users.
     */
    it('should return "not_determined" when no permission has been set', async () => {
      const { ThroneService } = createThroneService();
      const status = await ThroneService.getPermissionStatus();
      expect(status).toBe('not_determined');
    });

    /**
     * Verifies granted status is loaded from storage.
     */
    it('should return "granted" when permission was previously granted', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ throne: 'granted' })
      );

      const { ThroneService } = createThroneService();
      const status = await ThroneService.getPermissionStatus();
      expect(status).toBe('granted');
    });

    /**
     * Verifies skipped status is loaded from storage.
     */
    it('should return "skipped" when user previously skipped setup', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ throne: 'skipped' })
      );

      const { ThroneService } = createThroneService();
      const status = await ThroneService.getPermissionStatus();
      expect(status).toBe('skipped');
    });
  });

  /**
   * Tests for requestPermission()
   *
   * STUB BEHAVIOR: Simulates OAuth flow with 1-second delay,
   * then always returns 'granted'. In production, this would
   * open Throne's OAuth authorization page.
   */
  describe('requestPermission', () => {
    /**
     * Verifies stub always grants permission after simulated delay.
     * This tests the expected stub behavior, not real OAuth.
     */
    it('should return "granted" after simulated delay (stub behavior)', async () => {
      const { ThroneService } = createThroneService();

      const permissionPromise = ThroneService.requestPermission();

      // Advance past the 1-second simulated OAuth delay and flush promises
      await jest.advanceTimersByTimeAsync(1000);

      const status = await permissionPromise;
      expect(status).toBe('granted');
    });

    /**
     * Verifies permission status is persisted to AsyncStorage.
     */
    it('should persist granted permission to AsyncStorage', async () => {
      const { ThroneService } = createThroneService();

      const permissionPromise = ThroneService.requestPermission();
      await jest.advanceTimersByTimeAsync(1000);
      await permissionPromise;

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.PERMISSIONS_STATUS,
        expect.stringContaining('granted')
      );
    });
  });

  /**
   * Tests for skipSetup()
   *
   * Allows users to skip Throne setup during onboarding.
   * They can connect their device later from settings.
   */
  describe('skipSetup', () => {
    /**
     * Verifies skipped status is persisted to storage.
     */
    it('should persist "skipped" status to AsyncStorage', async () => {
      const { ThroneService } = createThroneService();
      await ThroneService.skipSetup();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.PERMISSIONS_STATUS,
        expect.stringContaining('skipped')
      );
    });

    /**
     * Verifies getPermissionStatus returns 'skipped' after skipSetup.
     */
    it('should report status as "skipped" after calling skipSetup', async () => {
      const { ThroneService } = createThroneService();
      await ThroneService.skipSetup();

      const status = await ThroneService.getPermissionStatus();
      expect(status).toBe('skipped');
    });
  });

  /**
   * Tests for getConnectionStatus()
   *
   * Returns device connection status:
   * - 'not_setup': Permission not granted yet
   * - 'disconnected': Permission granted but device not paired
   * - 'connecting': Attempting to connect
   * - 'connected': Device paired and ready
   *
   * STUB BEHAVIOR: Returns 'not_setup' if not granted,
   * otherwise 'disconnected' (never actually connects).
   */
  describe('getConnectionStatus', () => {
    /**
     * Verifies 'not_setup' when permission hasn't been granted.
     */
    it('should return "not_setup" when permission is not_determined', async () => {
      const { ThroneService } = createThroneService();
      const status = await ThroneService.getConnectionStatus();
      expect(status).toBe('not_setup');
    });

    /**
     * Verifies stub returns 'disconnected' when permission is granted
     * (since stub doesn't implement actual device pairing).
     */
    it('should return "disconnected" when permission is granted (stub behavior)', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ throne: 'granted' })
      );

      const { ThroneService } = createThroneService();
      const status = await ThroneService.getConnectionStatus();
      expect(status).toBe('disconnected');
    });

    /**
     * Verifies 'not_setup' when user skipped setup.
     */
    it('should return "not_setup" when permission was skipped', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ throne: 'skipped' })
      );

      const { ThroneService } = createThroneService();
      const status = await ThroneService.getConnectionStatus();
      expect(status).toBe('not_setup');
    });
  });

  /**
   * Tests for getMeasurements()
   *
   * STUB BEHAVIOR: Always returns empty array.
   * In production, this would fetch uroflow measurements from Throne API.
   *
   * TODO: When THRONE_API_IMPLEMENTED is true, update these tests to
   * verify real data is returned from the Throne API.
   */
  describe('getMeasurements', () => {
    /**
     * Verifies empty array when permission not granted.
     */
    it('should return empty array when permission not granted', async () => {
      const { ThroneService } = createThroneService();
      const measurements = await ThroneService.getMeasurements();
      expect(measurements).toEqual([]);
    });

    /**
     * STUB-ONLY TEST: Skip when real API is implemented.
     * Verifies stub returns empty array even with permission granted.
     */
    const stubDataTest = FEATURE_FLAGS.THRONE_API_IMPLEMENTED ? it.skip : it;
    stubDataTest('should return empty array when permission granted (stub has no mock data)', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ throne: 'granted' })
      );

      const { ThroneService } = createThroneService();
      const measurements = await ThroneService.getMeasurements();
      expect(measurements).toEqual([]);
    });

    /**
     * Verifies date range parameters are accepted (for API compatibility).
     */
    it('should accept date range parameters without error', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ throne: 'granted' })
      );

      const { ThroneService } = createThroneService();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // Should not throw, even though stub ignores the parameters
      const measurements = await ThroneService.getMeasurements(startDate, endDate);
      if (!FEATURE_FLAGS.THRONE_API_IMPLEMENTED) {
        expect(measurements).toEqual([]);
      } else {
        // TODO: When implemented, verify measurements are returned
        expect(Array.isArray(measurements)).toBe(true);
      }
    });
  });

  /**
   * Tests for getLatestMeasurement()
   *
   * STUB BEHAVIOR: Always returns null.
   * In production, this would return the most recent uroflow reading.
   *
   * TODO: When THRONE_API_IMPLEMENTED is true, update these tests to
   * verify real measurement data is returned.
   */
  describe('getLatestMeasurement', () => {
    /**
     * Verifies null when permission not granted.
     */
    it('should return null when permission not granted', async () => {
      const { ThroneService } = createThroneService();
      const measurement = await ThroneService.getLatestMeasurement();
      expect(measurement).toBeNull();
    });

    /**
     * STUB-ONLY TEST: Skip when real API is implemented.
     * Verifies stub returns null even with permission (no mock data).
     */
    const stubLatestTest = FEATURE_FLAGS.THRONE_API_IMPLEMENTED ? it.skip : it;
    stubLatestTest('should return null when permission granted (stub has no mock data)', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
        JSON.stringify({ throne: 'granted' })
      );

      const { ThroneService } = createThroneService();
      const measurement = await ThroneService.getLatestMeasurement();
      expect(measurement).toBeNull();
    });
  });

  /**
   * Tests for isThroneAvailable()
   *
   * Utility function to check if Throne integration is available.
   * STUB BEHAVIOR: Always returns true (UI will show "Coming Soon").
   */
  describe('isThroneAvailable', () => {
    /**
     * Verifies stub always reports Throne as available.
     */
    it('should return true (stub always reports available)', () => {
      const { isThroneAvailable } = createThroneService();
      expect(isThroneAvailable()).toBe(true);
    });
  });

  /**
   * Tests for error handling
   */
  describe('error handling', () => {
    /**
     * Verifies graceful handling of storage errors during initialization.
     * Should default to 'not_determined' status.
     */
    it('should handle storage errors and default to not_determined', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const { ThroneService } = createThroneService();
      const status = await ThroneService.getPermissionStatus();

      expect(status).toBe('not_determined');
    });
  });
});
