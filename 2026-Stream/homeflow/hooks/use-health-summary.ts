/**
 * Health Summary Hook
 *
 * Fetches HealthKit data and derives a HealthSummaryDay view model
 * for the Daily Check-In screen.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getDailyActivity,
  getSleep,
  getVitals,
  getDateRange,
} from '@/lib/services/healthkit';
import { buildHealthSummaryDay } from '@/lib/services/health-summary';
import { formatDateKey } from '@/lib/services/healthkit/mappers';
import type { HealthSummaryDay } from '@/lib/services/health-summary';

export function useHealthSummary(): {
  summary: HealthSummaryDay | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [summary, setSummary] = useState<HealthSummaryDay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        const range = getDateRange(8); // today + 7 days for baseline
        const [activityData, sleepData, vitalsData] = await Promise.all([
          getDailyActivity(range),
          getSleep(range),
          getVitals(range),
        ]);

        if (cancelled) return;

        // Today's date string (local timezone — matches how HealthKit data is bucketed)
        const today = formatDateKey(new Date());

        // Find today's data, falling back to most recent if today has none
        const todayActivity =
          activityData.find((d) => d.date === today) ??
          (activityData.length > 0 ? activityData[activityData.length - 1] : null);
        const todaySleep = sleepData.length > 0 ? sleepData[sleepData.length - 1] : null;
        const todayVitals =
          vitalsData.find((d) => d.date === today) ??
          (vitalsData.length > 0 ? vitalsData[vitalsData.length - 1] : null);

        // Recent sleep for baseline (exclude the selected entry)
        const recentSleep = todaySleep
          ? sleepData.filter((n) => n.date !== todaySleep.date)
          : sleepData.slice(1);

        const result = buildHealthSummaryDay(
          today,
          todaySleep,
          recentSleep,
          todayActivity,
          todayVitals,
        );

        if (!cancelled) {
          setSummary(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load health data');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { summary, isLoading, error, refresh };
}
