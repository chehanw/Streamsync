/**
 * Account Service
 *
 * Defines the account service interface and provides a local implementation.
 * Firebase implementation is in firebase-account-service.ts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

/**
 * User profile structure
 */
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Account service interface
 */
export interface IAccountService {
  // Profile management
  isAuthenticated(): Promise<boolean>;
  getCurrentUser(): Promise<UserProfile | null>;
  createAccount(profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserProfile>;
  updateProfile(updates: Partial<UserProfile>): Promise<UserProfile>;
  deleteAccount(): Promise<void>;

  // Auth methods
  signInWithEmail(email: string, password: string): Promise<UserProfile>;
  signUpWithEmail(email: string, password: string, profile: { firstName: string; lastName: string }): Promise<UserProfile>;
  signInWithApple(): Promise<UserProfile>;
  signInWithGoogle(): Promise<UserProfile>;
  signOut(): Promise<void>;
  sendPasswordResetEmail(email: string): Promise<void>;
  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void;
}

class LocalAccountService implements IAccountService {
  private profile: UserProfile | null = null;
  private initialized = false;

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ACCOUNT_PROFILE);
      if (data) {
        this.profile = JSON.parse(data);
      }
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize account service:', error);
      this.initialized = true;
    }
  }

  private generateId(): string {
    return `local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  async isAuthenticated(): Promise<boolean> {
    await this.initialize();
    return this.profile !== null;
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    await this.initialize();
    return this.profile;
  }

  async createAccount(
    profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<UserProfile> {
    const now = new Date().toISOString();

    this.profile = {
      ...profile,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    };

    await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNT_PROFILE, JSON.stringify(this.profile));
    return this.profile;
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    await this.initialize();

    if (!this.profile) {
      throw new Error('No account exists. Create an account first.');
    }

    this.profile = {
      ...this.profile,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(STORAGE_KEYS.ACCOUNT_PROFILE, JSON.stringify(this.profile));
    return this.profile;
  }

  async deleteAccount(): Promise<void> {
    this.profile = null;
    this.initialized = false;
    await AsyncStorage.removeItem(STORAGE_KEYS.ACCOUNT_PROFILE);
  }

  // Auth stubs for local mode — local mode auto-authenticates via createAccount
  async signInWithEmail(): Promise<UserProfile> {
    throw new Error('Email sign-in not available in local mode');
  }

  async signUpWithEmail(): Promise<UserProfile> {
    throw new Error('Email sign-up not available in local mode');
  }

  async signInWithApple(): Promise<UserProfile> {
    throw new Error('Apple sign-in not available in local mode');
  }

  async signInWithGoogle(): Promise<UserProfile> {
    throw new Error('Google sign-in not available in local mode');
  }

  async signOut(): Promise<void> {
    await this.deleteAccount();
  }

  async sendPasswordResetEmail(): Promise<void> {
    throw new Error('Password reset not available in local mode');
  }

  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void {
    // In local mode, immediately fire with current state
    this.initialize().then(() => callback(this.profile));
    return () => {};
  }
}

/**
 * Singleton instance of the local account service
 */
export const AccountService = new LocalAccountService();
