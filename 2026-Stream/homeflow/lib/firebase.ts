/**
 * Firebase Initialization
 *
 * Initializes Firebase app and auth for the Expo managed workflow.
 * Uses the JS SDK with AsyncStorage persistence (no native Firebase SDK needed).
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-expect-error - getReactNativePersistence exists at runtime but is missing from some type defs
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCA2UXlewWfadoemw4EinfMLyif6PgPyj4',
  authDomain: 'streamsync-8ae79.firebaseapp.com',
  projectId: 'streamsync-8ae79',
  storageBucket: 'streamsync-8ae79.firebasestorage.app',
  messagingSenderId: '295202330543',
  appId: '1:295202330543:web:9088db3e1f27518597015a',
};

function fromEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value || value.startsWith('YOUR_FIREBASE_')) {
    return fallback;
  }
  return value;
}

const firebaseConfig = {
  apiKey: fromEnv('EXPO_PUBLIC_FIREBASE_API_KEY', DEFAULT_FIREBASE_CONFIG.apiKey),
  authDomain: fromEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', DEFAULT_FIREBASE_CONFIG.authDomain),
  projectId: fromEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID', DEFAULT_FIREBASE_CONFIG.projectId),
  storageBucket: fromEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', DEFAULT_FIREBASE_CONFIG.storageBucket),
  messagingSenderId: fromEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', DEFAULT_FIREBASE_CONFIG.messagingSenderId),
  appId: fromEnv('EXPO_PUBLIC_FIREBASE_APP_ID', DEFAULT_FIREBASE_CONFIG.appId),
};

const existingApps = getApps();
const app = existingApps.length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = existingApps.length === 0
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

export default app;
