/**
 * Onboarding Progress Indicator
 *
 * Shows progress through the onboarding flow with animated dots.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, useColorScheme } from 'react-native';
import { ONBOARDING_FLOW, OnboardingStep } from '@/lib/constants';
import { Colors, StanfordColors } from '@/constants/theme';

interface OnboardingProgressProps {
  currentStep: OnboardingStep;
  style?: object;
}

export function OnboardingProgress({ currentStep, style }: OnboardingProgressProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const currentIndex = ONBOARDING_FLOW.indexOf(currentStep);
  // Don't show the "complete" step in the dots
  const totalSteps = ONBOARDING_FLOW.length - 1;

  const animatedValues = useRef(
    ONBOARDING_FLOW.slice(0, -1).map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    // Animate dots when step changes
    animatedValues.forEach((anim, index) => {
      Animated.spring(anim, {
        toValue: index <= currentIndex ? 1 : 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    });
  }, [currentIndex, animatedValues]);

  return (
    <View style={[styles.container, style]}>
      {ONBOARDING_FLOW.slice(0, -1).map((step, index) => {
        const isActive = index <= currentIndex;
        const isCurrent = index === currentIndex;

        const scale = animatedValues[index].interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.2],
        });

        return (
          <View key={step} style={styles.dotContainer}>
            <Animated.View
              style={[
                styles.dot,
                {
                  backgroundColor: isActive ? StanfordColors.cardinal : colors.border,
                  transform: isCurrent ? [{ scale }] : [],
                },
                isCurrent && styles.currentDot,
              ]}
            />
            {index < totalSteps - 1 && (
              <View
                style={[
                  styles.connector,
                  {
                    backgroundColor: index < currentIndex ? StanfordColors.cardinal : colors.border,
                  },
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Minimal progress bar variant
 */
export function OnboardingProgressBar({
  currentStep,
  style,
}: OnboardingProgressProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const currentIndex = ONBOARDING_FLOW.indexOf(currentStep);
  const totalSteps = ONBOARDING_FLOW.length - 1;
  const progress = (currentIndex / (totalSteps - 1)) * 100;

  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animatedWidth, {
      toValue: progress,
      useNativeDriver: false,
      tension: 50,
      friction: 10,
    }).start();
  }, [progress, animatedWidth]);

  return (
    <View style={[styles.barContainer, style]}>
      <View style={[styles.barBackground, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: StanfordColors.cardinal,
              width: animatedWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  dotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  currentDot: {
    shadowColor: StanfordColors.cardinal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  connector: {
    width: 24,
    height: 2,
    marginHorizontal: 4,
  },
  barContainer: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  barBackground: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
});
