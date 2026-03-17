/**
 * Firebase Client SDK initialization for StreamSync.
 * This config is safe to include in client code (public Firebase config).
 */

import {initializeApp, getApps, getApp} from "firebase/app";
import {getFirestore} from "firebase/firestore";

const firebaseConfig = {
  projectId: "streamsync-8ae79",
  appId: "1:295202330543:web:413b0d596e0ccb7b97015a",
  storageBucket: "streamsync-8ae79.firebasestorage.app",
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: "streamsync-8ae79.firebaseapp.com",
  messagingSenderId: "295202330543",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
console.log("[Firebase] Active projectId:", getApp().options.projectId);
export const db = getFirestore(app);
