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

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const existingApps = getApps();
const app = existingApps.length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = existingApps.length === 0
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

export default app;
