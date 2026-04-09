import { BackendConfig, BackendType } from './types';

/**
 * Backend Configuration
 *
 * Reads EXPO_PUBLIC_BACKEND_TYPE from environment to determine storage backend.
 * Defaults to Firebase when not set so device builds use the real backend.
 */
export function getBackendConfig(): BackendConfig {
  const backendType = (process.env.EXPO_PUBLIC_BACKEND_TYPE as BackendType) || 'firebase';

  if (backendType === 'firebase') {
    return {
      type: 'firebase',
      firebase: {
        apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
        authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
        projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
        storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
        messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
        appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
      },
    };
  }

  return { type: 'local' };
}
