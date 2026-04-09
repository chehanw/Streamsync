/**
 * Ineligible Screen
 *
 * Shown when a user doesn't meet the eligibility criteria.
 * Provides a kind explanation and contact information.
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Animated,
  Linking,
} from 'react-native';
import { useRouter, Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { STUDY_INFO, OnboardingStep } from '@/lib/constants';
import { OnboardingService } from '@/lib/services/onboarding-service';
import { ContinueButton } from '@/components/onboarding';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function IneligibleScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleContact = () => {
    Linking.openURL(`mailto:${STUDY_INFO.contactEmail}`);
  };

  const handleClose = () => {
    // In a real app, this might clear data and exit
    // For now, we'll just stay on this screen
  };

  // Dev-only: skip past ineligible to continue testing the flow
  const handleDevContinue = async () => {
    await OnboardingService.goToStep(OnboardingStep.CONSENT);
    router.push('/(onboarding)/consent' as Href);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.iconContainer}>
          <View
            style={[
              styles.iconBackground,
              { backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#F2F2F7' },
            ]}
          >
            <IconSymbol name={'person.2.fill' as any} size={64} color={colors.icon} />
          </View>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          We&apos;re Sorry
        </Text>

        <Text style={[styles.description, { color: colors.icon }]}>
          Based on your responses, you don&apos;t currently meet the eligibility criteria for the {STUDY_INFO.name}.
        </Text>

        <View
          style={[
            styles.infoBox,
            { backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#F2F2F7' },
          ]}
        >
          <Text style={[styles.infoTitle, { color: colors.text }]}>
            Why might I not be eligible?
          </Text>
          <Text style={[styles.infoText, { color: colors.icon }]}>
            This study requires:
            {'\n'}{'\n'}• An iPhone with iOS 15 or later
            {'\n'}• BPH or lower urinary tract symptoms suspected to be caused by BPH
            {'\n'}• Planning to undergo a bladder outlet procedure
          </Text>
        </View>

        <Text style={[styles.contactPrompt, { color: colors.text }]}>
          If you believe this is an error or have questions, please contact the research team.
        </Text>
      </Animated.View>

      <View style={styles.footer}>
        <ContinueButton
          title="Contact Research Team"
          onPress={handleContact}
          variant="secondary"
        />
        <ContinueButton
          title="Close"
          onPress={handleClose}
          variant="text"
        />
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: Spacing.xl * 2,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  infoBox: {
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  infoText: {
    fontSize: 15,
    lineHeight: 22,
  },
  contactPrompt: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
});
