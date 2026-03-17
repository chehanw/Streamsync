/**
 * Root Index
 *
 * Initial route that redirects based on onboarding and auth status.
 * Flow: Onboarding -> Auth -> Main App
 */

import React from 'react';
import { Redirect, Href } from 'expo-router';
import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { useAuth } from '@/hooks/use-auth';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { isDevAuthSkipped } from '@/lib/dev-flags';

export default function RootIndex() {
  const onboardingComplete = useOnboardingStatus();
  const { isAuthenticated, isLoading } = useAuth();

  if (onboardingComplete === null || isLoading) {
    return <LoadingScreen />;
  }

  if (!onboardingComplete) {
    return <Redirect href={'/(onboarding)' as Href} />;
  }

  if (!isAuthenticated && !isDevAuthSkipped()) {
    return <Redirect href={'/(auth)/login' as Href} />;
  }

  return <Redirect href="/(tabs)" />;
}
