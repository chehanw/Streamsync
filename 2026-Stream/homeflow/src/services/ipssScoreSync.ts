/**
 * IPSS Score Firestore Service
 *
 * Writes IPSS scores to Firestore under:
 *   users/{uid}/ipss_scores/{period}
 *
 * Periods:
 *   baseline  — collected during onboarding
 *   1_month   — 30 days post-surgery
 *   2_months  — 60 days post-surgery
 *   3_months  — 90 days post-surgery
 */

import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firestore";

export type IpssPeriod = "baseline" | "1_month" | "2_months" | "3_months";

export interface IpssScoreDocument {
  period: IpssPeriod;
  totalScore: number;
  qolScore: number;
  severity: "mild" | "moderate" | "severe";
  completedAt: string;         // ISO string — when the participant submitted
  responseId: string;
  savedAt: unknown;            // serverTimestamp()
}

/**
 * Write an IPSS score for a given period to Firestore.
 * Uses merge:false so each save is a clean overwrite of that period's doc.
 */
export async function saveIpssScore(
  uid: string,
  period: IpssPeriod,
  data: Omit<IpssScoreDocument, "savedAt">,
): Promise<void> {
  await setDoc(
    doc(db, `users/${uid}/ipss_scores/${period}`),
    { ...data, savedAt: serverTimestamp() },
    { merge: false },
  );
}

/**
 * Read an IPSS score for a given period from Firestore.
 * Returns null if not yet recorded.
 */
export async function fetchIpssScore(
  uid: string,
  period: IpssPeriod,
): Promise<IpssScoreDocument | null> {
  const snap = await getDoc(doc(db, `users/${uid}/ipss_scores/${period}`));
  if (!snap.exists()) return null;
  return snap.data() as IpssScoreDocument;
}
