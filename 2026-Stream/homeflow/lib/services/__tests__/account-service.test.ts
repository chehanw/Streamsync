/**
 * Unit Tests for Account Service
 *
 * The AccountService manages local user account/profile storage for the research study.
 * It provides a Firebase-compatible interface but stores data locally using AsyncStorage.
 *
 * Key behaviors tested:
 * - Lazy initialization from AsyncStorage on first access
 * - Profile CRUD operations (create, read, update, delete)
 * - Auto-generation of user IDs and timestamps
 * - Persistence to AsyncStorage
 * - Error handling for storage failures
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../constants';

/**
 * Helper to create a fresh AccountService instance for each test.
 * Uses jest.resetModules() to clear the singleton cache, ensuring
 * each test starts with a clean, uninitialized service.
 */
const createAccountService = () => {
  jest.resetModules();
  const { AccountService } = require('../account-service');
  return AccountService;
};

describe('AccountService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: simulate empty storage (no existing profile)
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  /**
   * Tests for isAuthenticated()
   *
   * This method checks whether a user profile exists, indicating
   * the user has completed account creation. Used by auth guards
   * to determine if the user can access protected screens.
   */
  describe('isAuthenticated', () => {
    /**
     * Verifies that a new/fresh app state (no profile in storage)
     * correctly reports as not authenticated.
     */
    it('should return false when no profile exists in storage', async () => {
      const service = createAccountService();
      const result = await service.isAuthenticated();
      expect(result).toBe(false);
    });

    /**
     * Verifies that when a profile exists in AsyncStorage,
     * the service correctly loads it and reports authenticated.
     */
    it('should return true when a valid profile exists in storage', async () => {
      const mockProfile = {
        id: 'local_123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockProfile));

      const service = createAccountService();
      const result = await service.isAuthenticated();
      expect(result).toBe(true);
    });

    /**
     * Verifies lazy initialization: the service should only read from
     * AsyncStorage once, then cache the result for subsequent calls.
     * This prevents unnecessary storage reads on repeated checks.
     */
    it('should only initialize once (lazy initialization caching)', async () => {
      const service = createAccountService();

      // Call multiple times
      await service.isAuthenticated();
      await service.isAuthenticated();
      await service.isAuthenticated();

      // AsyncStorage.getItem should only be called once during first initialization
      expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Tests for getCurrentUser()
   *
   * Returns the full UserProfile object or null if no account exists.
   * Used to display user info in the UI and for data submission.
   */
  describe('getCurrentUser', () => {
    /**
     * Verifies null is returned when no profile has been created,
     * allowing callers to distinguish between "no user" and "user exists".
     */
    it('should return null when no profile exists', async () => {
      const service = createAccountService();
      const result = await service.getCurrentUser();
      expect(result).toBeNull();
    });

    /**
     * Verifies that the full profile object is returned when it exists,
     * with all fields intact from storage.
     */
    it('should return the complete profile object when it exists', async () => {
      const mockProfile = {
        id: 'local_123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockProfile));

      const service = createAccountService();
      const result = await service.getCurrentUser();
      expect(result).toEqual(mockProfile);
    });
  });

  /**
   * Tests for createAccount()
   *
   * Creates a new user profile with auto-generated ID and timestamps.
   * The caller provides email, firstName, lastName; the service adds
   * id, createdAt, and updatedAt automatically.
   */
  describe('createAccount', () => {
    /**
     * Verifies that the service generates a unique local ID following
     * the pattern: local_{timestamp}_{random} for offline identification.
     */
    it('should generate a unique local ID with correct format', async () => {
      const service = createAccountService();

      const profile = await service.createAccount({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      // ID format: local_{timestamp}_{random alphanumeric}
      expect(profile.id).toMatch(/^local_\d+_[a-z0-9]+$/);
    });

    /**
     * Verifies that provided profile data is preserved in the created account.
     */
    it('should preserve provided profile data (email, firstName, lastName)', async () => {
      const service = createAccountService();

      const profile = await service.createAccount({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(profile.email).toBe('test@example.com');
      expect(profile.firstName).toBe('John');
      expect(profile.lastName).toBe('Doe');
    });

    /**
     * Verifies that createdAt and updatedAt timestamps are auto-generated
     * and set to the same value on initial creation.
     */
    it('should auto-generate createdAt and updatedAt timestamps', async () => {
      const service = createAccountService();

      const profile = await service.createAccount({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(profile.createdAt).toBeDefined();
      expect(profile.updatedAt).toBeDefined();
      // On creation, both timestamps should be identical
      expect(profile.createdAt).toBe(profile.updatedAt);
    });

    /**
     * Verifies that the new profile is persisted to AsyncStorage
     * so it survives app restarts.
     */
    it('should persist the new profile to AsyncStorage', async () => {
      const service = createAccountService();

      await service.createAccount({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.ACCOUNT_PROFILE,
        expect.any(String)
      );
    });

    /**
     * Verifies that after account creation, isAuthenticated() returns true.
     * This ensures the in-memory state is updated, not just storage.
     */
    it('should report authenticated immediately after account creation', async () => {
      const service = createAccountService();

      await service.createAccount({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      const isAuth = await service.isAuthenticated();
      expect(isAuth).toBe(true);
    });
  });

  /**
   * Tests for updateProfile()
   *
   * Allows partial updates to the user profile. Only provided fields
   * are changed; others are preserved. Updates the updatedAt timestamp.
   */
  describe('updateProfile', () => {
    /**
     * Verifies that attempting to update without an existing account
     * throws an appropriate error message.
     */
    it('should throw an error when no account exists', async () => {
      const service = createAccountService();

      await expect(service.updateProfile({ firstName: 'Jane' })).rejects.toThrow(
        'No account exists. Create an account first.'
      );
    });

    /**
     * Verifies that partial updates only change specified fields
     * while preserving other existing profile data.
     */
    it('should apply partial updates while preserving other fields', async () => {
      const service = createAccountService();

      await service.createAccount({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      // Clear mock to isolate the update call
      (AsyncStorage.setItem as jest.Mock).mockClear();

      const updated = await service.updateProfile({ firstName: 'Jane' });

      // Updated field should change
      expect(updated.firstName).toBe('Jane');
      // Other fields should remain unchanged
      expect(updated.lastName).toBe('Doe');
      expect(updated.email).toBe('test@example.com');
    });

    /**
     * Verifies that updates are persisted to AsyncStorage.
     */
    it('should persist updated profile to AsyncStorage', async () => {
      const service = createAccountService();

      await service.createAccount({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      (AsyncStorage.setItem as jest.Mock).mockClear();

      await service.updateProfile({ firstName: 'Jane' });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.ACCOUNT_PROFILE,
        expect.any(String)
      );
    });

    /**
     * Verifies that updatedAt timestamp is refreshed on each update,
     * allowing tracking of when the profile was last modified.
     */
    it('should update the updatedAt timestamp on each modification', async () => {
      const service = createAccountService();

      const original = await service.createAccount({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await service.updateProfile({ firstName: 'Jane' });

      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
        new Date(original.updatedAt).getTime()
      );
    });
  });

  /**
   * Tests for deleteAccount()
   *
   * Removes the user account from both memory and storage.
   * Used for account deletion or app reset functionality.
   */
  describe('deleteAccount', () => {
    /**
     * Verifies that the profile is removed from AsyncStorage.
     */
    it('should remove the profile from AsyncStorage', async () => {
      const service = createAccountService();

      await service.createAccount({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      await service.deleteAccount();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.ACCOUNT_PROFILE);
    });

    /**
     * Verifies that after deletion, the service reports not authenticated.
     * Note: We reset the mock to simulate actual cleared storage.
     */
    it('should report not authenticated after account deletion', async () => {
      const service = createAccountService();

      await service.createAccount({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      await service.deleteAccount();

      // Simulate that storage is now empty
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const isAuth = await service.isAuthenticated();
      expect(isAuth).toBe(false);
    });
  });

  /**
   * Tests for auth method stubs in local mode
   *
   * Local mode does not support Firebase auth methods.
   * These should throw descriptive errors.
   */
  describe('auth method stubs (local mode)', () => {
    it('should throw on signInWithEmail', async () => {
      const service = createAccountService();
      await expect(service.signInWithEmail('a@b.com', 'pass')).rejects.toThrow(
        'not available in local mode'
      );
    });

    it('should throw on signUpWithEmail', async () => {
      const service = createAccountService();
      await expect(
        service.signUpWithEmail('a@b.com', 'pass', { firstName: 'A', lastName: 'B' })
      ).rejects.toThrow('not available in local mode');
    });

    it('should throw on signInWithApple', async () => {
      const service = createAccountService();
      await expect(service.signInWithApple()).rejects.toThrow('not available in local mode');
    });

    it('should throw on signInWithGoogle', async () => {
      const service = createAccountService();
      await expect(service.signInWithGoogle()).rejects.toThrow('not available in local mode');
    });

    it('should call callback with current state on onAuthStateChanged', async () => {
      const service = createAccountService();
      const callback = jest.fn();
      service.onAuthStateChanged(callback);
      // Wait for async initialization
      await new Promise((r) => setTimeout(r, 50));
      expect(callback).toHaveBeenCalledWith(null);
    });

    it('should clear profile on signOut', async () => {
      const service = createAccountService();
      await service.createAccount({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });
      await service.signOut();
      const isAuth = await service.isAuthenticated();
      expect(isAuth).toBe(false);
    });
  });

  /**
   * Tests for error handling
   *
   * Verifies graceful handling of AsyncStorage failures.
   */
  describe('error handling', () => {
    /**
     * Verifies that storage read errors during initialization don't crash
     * the app - instead, the service treats it as "no profile exists".
     */
    it('should handle storage errors gracefully during initialization', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const service = createAccountService();
      const result = await service.isAuthenticated();

      // Should complete without throwing, defaulting to not authenticated
      expect(result).toBe(false);
    });
  });
});
