/**
 * Onboarding Complete Screen
 *
 * Celebration screen showing successful enrollment.
 * Transitions to the main app after a brief moment.
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, StanfordColors, Spacing } from '@/constants/theme';
import { STUDY_INFO, OnboardingStep } from '@/lib/constants';
import { OnboardingService } from '@/lib/services/onboarding-service';
import { notifyOnboardingComplete } from '@/hooks/use-onboarding-status';
import { ContinueButton } from '@/components/onboarding';
import { devSkipAuth } from '@/lib/dev-flags';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function CompleteScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [showButton, setShowButton] = useState(false);

  // Animations
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;
  const confettiOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Sequence of animations
    Animated.sequence([
      // Check icon appears
      Animated.parallel([
        Animated.spring(checkScale, {
          toValue: 1,
          tension: 50,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.timing(checkOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      // Brief confetti flash
      Animated.sequence([
        Animated.timing(confettiOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(confettiOpacity, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      // Content slides in
      Animated.parallel([
        Animated.timing(contentFade, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(contentSlide, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setShowButton(true);
    });
  }, [checkScale, checkOpacity, contentFade, contentSlide, confettiOpacity]);

  const handleSignIn = async () => {
    await OnboardingService.complete();
    notifyOnboardingComplete();
    router.replace('/(auth)/login' as any);
  };

  const handleDevContinue = async () => {
    devSkipAuth(); // Set flag BEFORE notifyOnboardingComplete so index.tsx re-render skips auth
    await OnboardingService.complete();
    notifyOnboardingComplete();
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Confetti effect (simplified) */}
        <Animated.View
          style={[
            styles.confettiContainer,
            { opacity: confettiOpacity },
          ]}
        >
          {['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181'].map((color, i) => (
            <View
              key={i}
              style={[
                styles.confettiDot,
                {
                  backgroundColor: color,
                  left: `${15 + i * 18}%`,
                  top: `${20 + (i % 3) * 10}%`,
                },
              ]}
            />
          ))}
        </Animated.View>

        {/* Success icon */}
        <Animated.View
          style={[
            styles.iconContainer,
            {
              opacity: checkOpacity,
              transform: [{ scale: checkScale }],
            },
          ]}
        >
          <View style={styles.iconBackground}>
            <IconSymbol name="checkmark.circle.fill" size={80} color="#34C759" />
          </View>
        </Animated.View>

        {/* Content */}
        <Animated.View
          style={{
            opacity: contentFade,
            transform: [{ translateY: contentSlide }],
            alignSelf: 'stretch',
          }}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            You&apos;re All Set!
          </Text>

          <Text style={[styles.subtitle, { color: colors.icon }]}>
            Welcome to the {STUDY_INFO.name}
          </Text>

          <View style={styles.features}>
            <FeatureRow
              icon="chart.line.uptrend.xyaxis"
              text="Track your symptoms over time"
              colors={colors}
            />
            <FeatureRow
              icon="bell.badge"
              text="Receive periodic survey reminders"
              colors={colors}
            />
            <FeatureRow
              icon="person.2"
              text="Contribute to BPH research"
              colors={colors}
            />
          </View>

          <View
            style={[
              styles.tipBox,
              { backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : 'rgba(140, 21, 21, 0.05)' },
            ]}
          >
            <IconSymbol name={'info.circle.fill' as any} size={20} color={StanfordColors.cardinal} />
            <Text style={[styles.tipText, { color: colors.text }]}>
              For the best experience, wear your Apple Watch regularly and keep the StreamSync app running in the background.
            </Text>
          </View>
        </Animated.View>
      </View>

      {showButton && (
        <Animated.View
          style={[
            styles.footer,
            { opacity: contentFade },
          ]}
        >
          <ContinueButton title="Sign In to Continue" onPress={handleSignIn} />
          {__DEV__ && (
            <TouchableOpacity
              style={styles.devBypassButton}
              onPress={handleDevContinue}
              activeOpacity={0.7}
            >
              <Text style={styles.devBypassText}>Dev — Skip Sign In</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

    </SafeAreaView>
  );
}

function FeatureRow({
  icon,
  text,
  colors,
}: {
  icon: string;
  text: string;
  colors: typeof Colors.light;
}) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIconContainer}>
        <IconSymbol name={icon as any} size={20} color={StanfordColors.cardinal} />
      </View>
      <Text style={[styles.featureText, { color: colors.text }]}>{text}</Text>
    </View>
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
    alignItems: 'center',
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  confettiDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  iconContainer: {
    marginBottom: Spacing.xl,
  },
  iconBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  features: {
    width: '100%',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(140, 21, 21, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  featureText: {
    fontSize: 16,
    flex: 1,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: Spacing.md,
    gap: 12,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  footer: {
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  devBypassButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  devBypassText: {
    fontSize: 13,
    color: '#FF9500',
    fontWeight: '600',
  },
});
