/**
 * Unit Tests for Backend Factory
 *
 * The BackendFactory creates backend service instances based on configuration.
 * Currently only supports 'local' (AsyncStorage) backend. When Firebase
 * feature is added, this factory will be replaced with one that supports
 * Firebase configuration.
 *
 * Key behaviors tested:
 * - Creating LocalStorageBackend for 'local' type
 * - Fallback behavior for unsupported backend types
 * - Independent instance creation (not singleton)
 */

import { BackendFactory } from '../backend-factory';
import { LocalStorageBackend } from '../backends/local-storage';

/**
 * FEATURE FLAGS
 *
 * Set these to true when the corresponding feature is implemented.
 */
const FEATURE_FLAGS = {
  /**
   * Set to true when Firebase backend is implemented.
   * When true, the 'firebase' type test should expect FirebaseBackend.
   */
  FIREBASE_BACKEND_IMPLEMENTED: false,
};

describe('BackendFactory', () => {
  /**
   * Tests for createBackend()
   *
   * Factory method that creates the appropriate backend service
   * based on the provided configuration.
   */
  describe('createBackend', () => {
    /**
     * Verifies that 'local' type creates a LocalStorageBackend instance.
     * This is the default and currently only supported backend.
     */
    it('should create LocalStorageBackend for "local" type', () => {
      const backend = BackendFactory.createBackend({ type: 'local' });
      expect(backend).toBeInstanceOf(LocalStorageBackend);
    });

    /**
     * Verifies graceful fallback to LocalStorageBackend when an
     * unknown/unsupported backend type is requested.
     * The factory logs a warning but doesn't throw.
     */
    it('should fallback to LocalStorageBackend for unknown types', () => {
      // @ts-expect-error - Intentionally testing with invalid type
      const backend = BackendFactory.createBackend({ type: 'unknown' });
      expect(backend).toBeInstanceOf(LocalStorageBackend);
    });

    /**
     * Tests 'firebase' backend type.
     *
     * When FIREBASE_BACKEND_IMPLEMENTED is false: expects fallback to LocalStorageBackend
     * When FIREBASE_BACKEND_IMPLEMENTED is true: expects FirebaseBackend instance
     *
     * To enable: Set FEATURE_FLAGS.FIREBASE_BACKEND_IMPLEMENTED = true
     * and import FirebaseBackend from '../backends/firebase'
     */
    it('should handle "firebase" type based on implementation status', () => {
      const backend = BackendFactory.createBackend({ type: 'firebase' });

      if (FEATURE_FLAGS.FIREBASE_BACKEND_IMPLEMENTED) {
        // TODO: When Firebase is implemented, update this assertion:
        // expect(backend).toBeInstanceOf(FirebaseBackend);
        throw new Error(
          'FIREBASE_BACKEND_IMPLEMENTED is true but FirebaseBackend assertion not updated. ' +
            'Import FirebaseBackend and update the expect() call.'
        );
      } else {
        // Firebase not implemented - should fallback to LocalStorageBackend
        expect(backend).toBeInstanceOf(LocalStorageBackend);
      }
    });

    /**
     * Verifies that each call creates a new independent instance,
     * not a singleton. This allows multiple backends if needed.
     */
    it('should create independent instances on each call (not singleton)', () => {
      const backend1 = BackendFactory.createBackend({ type: 'local' });
      const backend2 = BackendFactory.createBackend({ type: 'local' });
      expect(backend1).not.toBe(backend2);
    });
  });
});
