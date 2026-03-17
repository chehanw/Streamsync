/**
 * Central Firebase access point for the StreamSync app.
 *
 * Intentionally does NOT re-initialize Firebase — that is owned by
 * ./firebase.ts.  This module simply gathers the app-level singletons
 * and re-exports the Firestore helpers that service modules need so
 * they have a single, consistent import target.
 */

import { getApp } from "firebase/app";
import { getAuth as _getAuth } from "firebase/auth";
import {
  getFirestore as _getFirestore,
  serverTimestamp,
  Timestamp,
  deleteField,
} from "firebase/firestore";
import type { FieldValue } from "firebase/firestore";

// Re-export the Firestore instance created by ./firebase.ts
export { db } from "./firebase";

// ── Singleton getters ─────────────────────────────────────────────────────────
// Lazy-evaluated so they are safe to call before any React component mounts.

/** Returns the default Firebase Auth instance. */
export function getAuth() {
  return _getAuth(getApp());
}

/** Returns the default Firestore instance (same singleton as `db`). */
export function getFirestore() {
  return _getFirestore(getApp());
}

// ── Firestore helpers ─────────────────────────────────────────────────────────

export { serverTimestamp, Timestamp, deleteField };
export type { FieldValue };
