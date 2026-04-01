/**
 * Firebase Client SDK initialization for StreamSync.
 * This config is safe to include in client code (public Firebase config).
 */

import {initializeApp, getApps, getApp} from "firebase/app";
import {getFirestore} from "firebase/firestore";

const DEFAULT_FIREBASE_CONFIG = {
  projectId: "streamsync-8ae79",
  appId: "1:295202330543:web:9088db3e1f27518597015a",
  storageBucket: "streamsync-8ae79.firebasestorage.app",
  apiKey: "AIzaSyCA2UXlewWfadoemw4EinfMLyif6PgPyj4",
  authDomain: "streamsync-8ae79.firebaseapp.com",
  messagingSenderId: "295202330543",
};

function fromEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value || value.startsWith("YOUR_FIREBASE_")) {
    return fallback;
  }
  return value;
}

const firebaseConfig = {
  projectId: fromEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID", DEFAULT_FIREBASE_CONFIG.projectId),
  appId: fromEnv("EXPO_PUBLIC_FIREBASE_APP_ID", DEFAULT_FIREBASE_CONFIG.appId),
  storageBucket: fromEnv("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET", DEFAULT_FIREBASE_CONFIG.storageBucket),
  apiKey: fromEnv("EXPO_PUBLIC_FIREBASE_API_KEY", DEFAULT_FIREBASE_CONFIG.apiKey),
  authDomain: fromEnv("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN", DEFAULT_FIREBASE_CONFIG.authDomain),
  messagingSenderId: fromEnv("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", DEFAULT_FIREBASE_CONFIG.messagingSenderId),
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
console.log("[Firebase] Active projectId:", getApp().options.projectId);
export const db = getFirestore(app);
