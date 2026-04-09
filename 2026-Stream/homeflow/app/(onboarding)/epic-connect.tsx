/**
 * Onboarding — Health Records
 *
 * Optional step that lets patients connect a SMART-compatible health system before the
 * baseline survey.  They can skip this at any time and connect later
 * from Profile → Health Records.
 *
 * Flow:
 *   connect button  →  /smart-connect modal  →  back here (Firestore updated)
 *   skip link       →  /(onboarding)/baseline-survey
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import { useRouter, Href, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, StanfordColors, Spacing } from '@/constants/theme';
import { OnboardingStep } from '@/lib/constants';
import { OnboardingService } from '@/lib/services/onboarding-service';
import { getConnectedSmartProviderStatus } from '@/lib/services/smart';
import { OnboardingProgressBar, ContinueButton } from '@/components/onboarding';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getAuth } from '@/src/services/firestore';

export default function EpicConnectScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  const [providerConnected, setProviderConnected] = useState(false);
  const [providerName, setProviderName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Re-check connection status each time we return from /smart-connect
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      async function checkConnection() {
        const uid = getAuth().currentUser?.uid;
        if (!uid) return;
        try {
          const connection = await getConnectedSmartProviderStatus(uid);
          if (cancelled) return;
          if (connection) {
            setProviderConnected(true);
            setProviderName(connection.providerName);
          } else {
            setProviderConnected(false);
            setProviderName(null);
          }
        } catch {
          // Ignore — user can still skip
        }
      }
      checkConnection();
      return () => { cancelled = true; };
    }, []),
  );

  const handleConnect = () => {
    router.push('/smart-connect' as Href);
  };

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      await OnboardingService.goToStep(OnboardingStep.BASELINE_SURVEY);
      router.push('/(onboarding)/baseline-survey' as Href);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    await OnboardingService.goToStep(OnboardingStep.BASELINE_SURVEY);
    router.push('/(onboarding)/baseline-survey' as Href);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <OnboardingProgressBar currentStep={OnboardingStep.BASELINE_SURVEY} />
      </View>

      <View style={styles.content}>
        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(140,21,21,0.15)' : 'rgba(140,21,21,0.08)' }]}>
          <IconSymbol name="doc.text.fill" size={44} color={StanfordColors.cardinal} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          Connect Health Records
        </Text>

        <Text style={[styles.description, { color: colors.icon }]}>
          Importing records from a SMART-compatible health system helps the study team
          understand your medical history without extra forms. Epic Sandbox remains
          available here for development and testing.
        </Text>

        {/* Connection status badge */}
        {providerConnected && (
          <View style={[styles.connectedBadge, { backgroundColor: isDark ? '#1C3A1C' : '#EAF7EA' }]}>
            <IconSymbol name="checkmark.circle.fill" size={16} color="#34C759" />
            <Text style={[styles.connectedText, { color: isDark ? '#34C759' : '#1A7A32' }]}>
              {providerName ? `Connected to ${providerName}` : 'Health system connected'}
            </Text>
          </View>
        )}

        {/* Connect / Reconnect button */}
        {!providerConnected ? (
          <TouchableOpacity
            style={[styles.connectButton, { backgroundColor: StanfordColors.cardinal }]}
            onPress={handleConnect}
            activeOpacity={0.8}
          >
            <IconSymbol name="doc.text.fill" size={18} color="#FFFFFF" />
            <Text style={styles.connectButtonText}>Connect Health Records</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.reconnectButton, { borderColor: StanfordColors.cardinal }]}
            onPress={handleConnect}
            activeOpacity={0.8}
          >
            <Text style={[styles.reconnectButtonText, { color: StanfordColors.cardinal }]}>
              Change Health System
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <ContinueButton
          title={providerConnected ? 'Continue' : 'Continue Without Records'}
          onPress={handleContinue}
          loading={isLoading}
        />
        {!providerConnected && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={[styles.skipText, { color: colors.icon }]}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Spacing.sm },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: Spacing.lg,
  },
  connectedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: Spacing.sm,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  reconnectButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  reconnectButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  skipButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
