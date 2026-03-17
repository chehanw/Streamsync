/**
 * Surgery Date Hook
 *
 * Resolves the surgery date with the following priority:
 *   1. Firestore (authoritative — set after login via saveSurgeryDate)
 *   2. OnboardingService / AsyncStorage (set during eligibility before login)
 *   3. Dev placeholder (14 days from now, __DEV__ only)
 *
 * Re-fetches whenever the authenticated user changes.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { fetchSurgeryDate } from '@/src/services/throneFirestore';
import { OnboardingService } from '@/lib/services/onboarding-service';
import { DEV_FIREBASE_UID } from '@/lib/constants';

interface SurgeryDateInfo {
  /** The surgery date string (YYYY-MM-DD) or null */
  date: string | null;
  /** Human-readable label like "March 15, 2026" */
  dateLabel: string;
  /** Whether the surgery date has passed */
  hasPassed: boolean;
  /** Whether this is using placeholder data */
  isPlaceholder: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Study start date (YYYY-MM-DD) — 7 days before surgery */
  studyStartDate: string | null;
  studyStartLabel: string;
  /** Study end date (YYYY-MM-DD) — 90 days after surgery */
  studyEndDate: string | null;
  studyEndLabel: string;
}

const NOT_SCHEDULED: Omit<SurgeryDateInfo, 'isLoading'> = {
  date: null,
  dateLabel: 'Not scheduled',
  hasPassed: false,
  isPlaceholder: true,
  studyStartDate: null,
  studyStartLabel: 'Not scheduled',
  studyEndDate: null,
  studyEndLabel: 'Not scheduled',
};

// Dev placeholder: surgery 2 weeks from now
function getPlaceholderDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDateLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildInfo(dateStr: string, isPlaceholder: boolean): SurgeryDateInfo {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const surgDate = new Date(dateStr + 'T12:00:00');
  const startDate = addDays(dateStr, -7);
  const endDate = addDays(dateStr, 90);

  return {
    date: dateStr,
    dateLabel: formatDateLabel(dateStr),
    hasPassed: surgDate <= today,
    isPlaceholder,
    isLoading: false,
    studyStartDate: startDate,
    studyStartLabel: formatDateLabel(startDate),
    studyEndDate: endDate,
    studyEndLabel: formatDateLabel(endDate),
  };
}

export function useSurgeryDate(): SurgeryDateInfo {
  const { user } = useAuth();
  const uid = user?.id ?? (__DEV__ ? DEV_FIREBASE_UID : null);

  const [info, setInfo] = useState<SurgeryDateInfo>({
    ...NOT_SCHEDULED,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // 1. Firestore — most authoritative, available after login
        if (uid) {
          const firestoreDate = await fetchSurgeryDate(uid);
          if (!cancelled && firestoreDate) {
            setInfo(buildInfo(firestoreDate, false));
            return;
          }
        }

        if (cancelled) return;

        // 2. OnboardingService (AsyncStorage) — available before/after login
        const onboardingData = await OnboardingService.getData();
        const localDate = onboardingData.eligibility?.surgeryDate ?? null;

        if (!cancelled && localDate) {
          setInfo(buildInfo(localDate, false));
          return;
        }

        if (cancelled) return;

        // 3. Dev placeholder
        if (__DEV__) {
          setInfo(buildInfo(getPlaceholderDate(), true));
        } else {
          setInfo({ ...NOT_SCHEDULED, isLoading: false });
        }
      } catch {
        if (!cancelled) {
          setInfo({ ...NOT_SCHEDULED, isLoading: false });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [uid]);

  return info;
}
