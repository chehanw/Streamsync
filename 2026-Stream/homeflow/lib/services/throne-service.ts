/**
 * Throne Service (Stubbed)
 *
 * Integration with Throne uroflowmetry device.
 * This is a stub implementation for the MVP - replace with real API when available.
 *
 * Throne provides:
 * - Void timestamp and voided volume
 * - Maximum flow rate (Qmax) and average flow rate (Qavg)
 * - Flow curve shape
 * - Voiding frequency and nocturia events
 * - Patient annotations (straining, urgency)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

/**
 * Throne permission status
 */
export type ThronePermissionStatus = 'granted' | 'denied' | 'not_determined' | 'skipped';

/**
 * Throne device connection status
 */
export type ThroneConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'not_setup';

/**
 * Uroflow measurement data
 */
export interface UroflowMeasurement {
  id: string;
  timestamp: string;
  voidedVolume: number; // mL
  maxFlowRate: number; // mL/s (Qmax)
  avgFlowRate: number; // mL/s (Qavg)
  flowTime: number; // seconds
  voidingTime: number; // seconds
  timeToMaxFlow: number; // seconds
  annotations?: {
    straining?: boolean;
    urgency?: boolean;
    incomplete?: boolean;
    notes?: string;
  };
}

/**
 * Throne service interface
 */
export interface IThroneService {
  getPermissionStatus(): Promise<ThronePermissionStatus>;
  requestPermission(): Promise<ThronePermissionStatus>;
  skipSetup(): Promise<void>;
  getConnectionStatus(): Promise<ThroneConnectionStatus>;
  getMeasurements(startDate?: Date, endDate?: Date): Promise<UroflowMeasurement[]>;
  getLatestMeasurement(): Promise<UroflowMeasurement | null>;
}

class StubThroneService implements IThroneService {
  private permissionStatus: ThronePermissionStatus = 'not_determined';
  private initialized = false;

  /**
   * Initialize by loading status from storage
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PERMISSIONS_STATUS);
      if (data) {
        const permissions = JSON.parse(data);
        this.permissionStatus = permissions.throne || 'not_determined';
      }
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize throne service:', error);
      this.initialized = true;
    }
  }

  /**
   * Persist permission status
   */
  private async persistStatus(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PERMISSIONS_STATUS);
      const permissions = data ? JSON.parse(data) : {};
      permissions.throne = this.permissionStatus;
      await AsyncStorage.setItem(STORAGE_KEYS.PERMISSIONS_STATUS, JSON.stringify(permissions));
    } catch (error) {
      console.error('Failed to persist throne status:', error);
    }
  }

  /**
   * Get current permission status
   */
  async getPermissionStatus(): Promise<ThronePermissionStatus> {
    await this.initialize();
    return this.permissionStatus;
  }

  /**
   * Mark Throne as connected after the user has supplied their Throne User ID.
   *
   * SHORT-TERM: The caller (permissions screen) collects the Throne User ID via
   * a text input and writes it to Firestore before calling this method. This
   * method simply records the granted state locally.
   *
   * LONG-TERM (uncomment when real Throne SDK is available):
   * Replace the body below with the OAuth flow. The SDK will return a throneUserId
   * which the caller can then pass to saveThroneUserId() before calling this.
   *
   * // const throneResult = await ThroneSDK.authorize({ studyId: THRONE_STUDY_ID });
   * // await saveThroneUserId(firebaseUid, throneResult.userId);
   * // this.permissionStatus = 'granted';
   * // await this.persistStatus();
   * // return this.permissionStatus;
   */
  async requestPermission(): Promise<ThronePermissionStatus> {
    await this.initialize();
    this.permissionStatus = 'granted';
    await this.persistStatus();
    return this.permissionStatus;
  }

  /**
   * Skip Throne setup (user can set up later)
   */
  async skipSetup(): Promise<void> {
    await this.initialize();
    this.permissionStatus = 'skipped';
    await this.persistStatus();
  }

  /**
   * Get device connection status
   * STUB: Returns 'not_setup' until permissions are granted
   */
  async getConnectionStatus(): Promise<ThroneConnectionStatus> {
    await this.initialize();

    if (this.permissionStatus !== 'granted') {
      return 'not_setup';
    }

    // In production, this would check actual device connection
    return 'disconnected';
  }

  /**
   * Get uroflow measurements
   * STUB: Returns empty array (no mock data in stub mode)
   */
  async getMeasurements(_startDate?: Date, _endDate?: Date): Promise<UroflowMeasurement[]> {
    await this.initialize();

    if (this.permissionStatus !== 'granted') {
      return [];
    }

    // In production, this would fetch from Throne API
    return [];
  }

  /**
   * Get the latest uroflow measurement
   * STUB: Returns null (no mock data in stub mode)
   */
  async getLatestMeasurement(): Promise<UroflowMeasurement | null> {
    await this.initialize();

    if (this.permissionStatus !== 'granted') {
      return null;
    }

    // In production, this would fetch from Throne API
    return null;
  }
}

/**
 * Singleton instance of the Throne service
 */
export const ThroneService = new StubThroneService();

/**
 * Check if Throne integration is available
 * In production, this would check for the Throne SDK
 */
export function isThroneAvailable(): boolean {
  // Stub: Always return true (UI will show "Coming Soon")
  return true;
}
