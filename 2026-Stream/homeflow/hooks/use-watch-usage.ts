/**
 * Watch Usage Status Hook (Stub)
 *
 * Provides a clean interface for checking if the user has worn their
 * Apple Watch recently. Currently stubbed — will be wired to real
 * HealthKit data (e.g., checking for recent heart rate samples).
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

interface WatchUsageStatus {
  /** Whether watch data has been recorded today */
  hasWatchDataToday: boolean;
  /** Whether the watch was worn recently (last 24h) */
  watchWornRecently: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Re-check watch status */
  refresh: () => void;
}

export function useWatchUsage(): WatchUsageStatus {
  const [hasWatchDataToday, setHasWatchDataToday] = useState(false);
  const [watchWornRecently, setWatchWornRecently] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkWatchStatus() {
      setIsLoading(true);

      // Stub: on iOS, default to false so the reminder shows.
      // When wired to real HealthKit, check for recent heart rate samples.
      const hasData = Platform.OS !== 'ios' ? false : false;

      if (!cancelled) {
        setHasWatchDataToday(hasData);
        setWatchWornRecently(hasData);
        setIsLoading(false);
      }
    }

    checkWatchStatus();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { hasWatchDataToday, watchWornRecently, isLoading, refresh };
}
