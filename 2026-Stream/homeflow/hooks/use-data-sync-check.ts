/**
 * useDataSyncCheck
 *
 * Runs the 48-hour data sync check whenever the app comes to the foreground.
 * Only active when the user is authenticated and onboarding is complete.
 */

import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { checkAndScheduleReminders } from '@/lib/services/notification-service';

export function useDataSyncCheck(active: boolean): void {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!active) return;

    // Run on mount
    checkAndScheduleReminders().catch(() => {});

    // Run every time the app comes back to the foreground
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        checkAndScheduleReminders().catch(() => {});
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [active]);
}
