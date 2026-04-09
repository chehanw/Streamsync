import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

// Suppress all JS warnings in the dev overlay so the Expo warning toast does not
// fire macOS UserNotificationCenter alerts that block Simulator interaction.
// Safe to remove once the app is ready for production.
import { LogBox as RNLogBox } from 'react-native';
RNLogBox.ignoreAllLogs();
// Global CSS for web (theming for alert dialogs, etc.) - only processed on web
import '@/assets/styles/global.css';
import { bootstrapHealthKitSync } from '@/src/services/healthkitSync';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/src/services/firebase';

import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { useAuth } from '@/hooks/use-auth';
import { useDataSyncCheck } from '@/hooks/use-data-sync-check';
import { useIPSSTaskSetup } from '@/hooks/use-ipss-task-setup';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { ErrorBoundary } from '@/components/error-boundary';
import { StandardProvider, useStandard } from '@/lib/services/standard-context';
import { AppThemeProvider, useAppTheme } from '@/lib/theme/ThemeContext';

// Module-level guards — survive Fast Refresh hot reloads (unlike useRef).
const _bootstrappedUids = new Set<string>();
const _throneSyncRequestedUids = new Set<string>();

export const unstable_settings = {
  // Initial route while loading
  initialRouteName: 'index',
};

// TEMP DEV BYPASS: skip auth requirement so tabs are accessible without signing in.
// Remove this (and the uses below) when auth is ready to test end-to-end.
const DEV_BYPASS_AUTH = false;

/**
 * Navigation stack with onboarding, auth, and main app routes
 */
function RootLayoutNav() {
  const onboardingComplete = useOnboardingStatus();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  // Seed IPSS follow-up tasks at 1, 2, and 3 months post-surgery
  useIPSSTaskSetup();

  // Run bootstrapHealthKitSync exactly once per signed-in uid.
  // Module-level Set survives Fast Refresh; a ref would reset on every hot reload.
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    if (_bootstrappedUids.has(uid)) return;
    _bootstrappedUids.add(uid);

    // Delay 4 s so the home screen's HealthKit queries (12 parallel reads) complete
    // first. HealthKit serializes concurrent queries — without the delay the sync
    // pipeline backs them up and the UI feels frozen on first load.
    const timer = setTimeout(() => {
      bootstrapHealthKitSync().catch((err) =>
        console.error("[HealthKit] bootstrapHealthKitSync error:", err),
      );
    }, 4000);

    return () => clearTimeout(timer);
  }, [user?.id]);

  // On first open per uid: write a Firestore doc that triggers the Cloud Function
  // to pull Throne data immediately. After the first sync the daily 3 AM schedule takes over.
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    if (_throneSyncRequestedUids.has(uid)) return;
    _throneSyncRequestedUids.add(uid);

    async function requestSyncIfNeeded() {
      // Always write on app open — the cloud function rate-limits to once/hour.
      await setDoc(
        doc(db, `users/${uid}/sync_requests/latest`),
        { requestedAt: new Date().toISOString(), source: 'app_open' },
      );
    }

    requestSyncIfNeeded().catch((err) =>
      console.warn('[Throne] sync request error:', err),
    );
  }, [user?.id]);

  // Run 48-hour data sync check only when user is fully in the app
  useDataSyncCheck(!!onboardingComplete && isAuthenticated);

  // While checking onboarding/auth status, show loading
  if (onboardingComplete === null || authLoading) {
    return <LoadingScreen />;
  }

  const authed = isAuthenticated || DEV_BYPASS_AUTH;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Onboarding flow - shown when not complete */}
      <Stack.Screen
        name="(onboarding)"
        options={{
          animation: 'fade',
        }}
        redirect={onboardingComplete}
      />

      {/* Auth flow - shown when onboarding complete but not signed in */}
      <Stack.Screen
        name="(auth)"
        options={{
          animation: 'fade',
        }}
        redirect={!onboardingComplete || isAuthenticated}
      />

      {/* Main app - shown when onboarding complete AND signed in (or dev bypass) */}
      <Stack.Screen
        name="(tabs)"
        redirect={!onboardingComplete || !authed}
      />

      {/* Modal screens */}
      <Stack.Screen
        name="questionnaire"
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="modal"
        options={{ presentation: 'modal', title: 'Modal', headerShown: true }}
      />
      <Stack.Screen
        name="consent-viewer"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="throne-session"
        options={{ headerShown: false }}
      />

      {/* Post-surgery recovery instructions (Stanford HoLEP discharge) */}
      <Stack.Screen
        name="post-surgery-recovery"
        options={{ headerShown: false }}
      />

      {/* Index route for initial redirect */}
      <Stack.Screen
        name="index"
        options={{ animation: 'none' }}
      />
    </Stack>
  );
}

function AppContent({ children }: { children: React.ReactNode }) {
  const { isLoading } = useStandard();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}

/**
 * Inner shell — has access to AppThemeProvider so it can read the resolved theme
 * and pass it to React Navigation's ThemeProvider + StatusBar.
 */
function ThemedApp() {
  const { theme } = useAppTheme();

  return (
    <ThemeProvider value={theme.isDark ? DarkTheme : DefaultTheme}>
      <StandardProvider>
        <AppContent>
          <RootLayoutNav />
          <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        </AppContent>
      </StandardProvider>
    </ThemeProvider>
  );
}

/**
 * Root Layout
 *
 * Handles onboarding, authentication, and main app navigation.
 * Flow: Onboarding -> Auth -> Main App
 */
export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AppThemeProvider>
        <ThemedApp />
      </AppThemeProvider>
    </ErrorBoundary>
  );
}
