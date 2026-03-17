/**
 * Consent Service
 *
 * Manages informed consent recording and verification for the research study.
 * Stores consent status, version, and timestamp for IRB compliance.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, CONSENT_VERSION, STUDY_INFO } from '../constants';

/**
 * Consent record structure
 */
export interface ConsentRecord {
  given: boolean;
  version: string;
  timestamp: string;
  participantSignature?: string; // Could be typed name or actual signature
  studyName: string;
  irbProtocol: string;
}

class ConsentServiceImpl {
  private consentRecord: ConsentRecord | null = null;
  private initialized = false;

  /**
   * Initialize by loading consent status from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const given = await AsyncStorage.getItem(STORAGE_KEYS.CONSENT_GIVEN);
      const date = await AsyncStorage.getItem(STORAGE_KEYS.CONSENT_DATE);
      const version = await AsyncStorage.getItem(STORAGE_KEYS.CONSENT_VERSION);

      if (given === 'true' && date && version) {
        this.consentRecord = {
          given: true,
          version,
          timestamp: date,
          studyName: STUDY_INFO.name,
          irbProtocol: STUDY_INFO.irbProtocol,
        };
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize consent service:', error);
      this.initialized = true;
    }
  }

  /**
   * Check if consent has been given
   */
  async hasConsented(): Promise<boolean> {
    await this.initialize();
    return this.consentRecord?.given === true;
  }

  /**
   * Check if consent is current (matches current version)
   */
  async isConsentCurrent(): Promise<boolean> {
    await this.initialize();

    if (!this.consentRecord?.given) return false;
    return this.consentRecord.version === CONSENT_VERSION;
  }

  /**
   * Record consent
   */
  async recordConsent(signature?: string): Promise<void> {
    const now = new Date().toISOString();

    this.consentRecord = {
      given: true,
      version: CONSENT_VERSION,
      timestamp: now,
      participantSignature: signature,
      studyName: STUDY_INFO.name,
      irbProtocol: STUDY_INFO.irbProtocol,
    };

    await AsyncStorage.setItem(STORAGE_KEYS.CONSENT_GIVEN, 'true');
    await AsyncStorage.setItem(STORAGE_KEYS.CONSENT_DATE, now);
    await AsyncStorage.setItem(STORAGE_KEYS.CONSENT_VERSION, CONSENT_VERSION);
  }

  /**
   * Withdraw consent (for participant withdrawal)
   */
  async withdrawConsent(): Promise<void> {
    this.consentRecord = null;

    await AsyncStorage.multiRemove([
      STORAGE_KEYS.CONSENT_GIVEN,
      STORAGE_KEYS.CONSENT_DATE,
      STORAGE_KEYS.CONSENT_VERSION,
    ]);
  }

  /**
   * Get the consent record
   */
  async getConsentRecord(): Promise<ConsentRecord | null> {
    await this.initialize();
    return this.consentRecord;
  }

  /**
   * Get the current consent version
   */
  getCurrentVersion(): string {
    return CONSENT_VERSION;
  }

  /**
   * Check if re-consent is needed (version mismatch)
   */
  async needsReconsent(): Promise<boolean> {
    await this.initialize();

    if (!this.consentRecord?.given) return false;
    return this.consentRecord.version !== CONSENT_VERSION;
  }
}

/**
 * Singleton instance of the consent service
 */
export const ConsentService = new ConsentServiceImpl();
