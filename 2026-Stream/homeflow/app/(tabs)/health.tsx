import React from 'react';
import {
  StyleSheet,
  Platform,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHealthSummary } from '@/hooks/use-health-summary';
import { SleepSection } from '@/components/health/SleepSection';
import { ActivitySection } from '@/components/health/ActivitySection';
import { VitalsSection } from '@/components/health/VitalsSection';
import { useAppTheme } from '@/lib/theme/ThemeContext';
import { FontSize, FontWeight } from '@/lib/theme/typography';

export default function HealthScreen() {
  const { theme } = useAppTheme();
  const { colors: c } = theme;

  if (Platform.OS !== 'ios') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: c.textTertiary }]}>
            Health data is available on iPhone
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return <HealthContent />;
}

function HealthContent() {
  const { theme } = useAppTheme();
  const { colors: c } = theme;
  const { summary, isLoading, error } = useHealthSummary();

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#8E8E93" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: c.textTertiary }]}>
            {error}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!summary) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: c.textTertiary }]}>
            No health data available yet. Wear your Apple Watch today and check back later.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.dateLabel, { color: c.textTertiary }]}>
          {summary.dateLabel}
        </Text>
        <Text style={[styles.greeting, { color: c.textPrimary }]}>
          {summary.greeting}
        </Text>

        <View style={styles.spacerLarge} />

        {summary.sleep && <SleepSection insight={summary.sleep} />}

        <View style={styles.spacerMedium} />

        {summary.activity && <ActivitySection insight={summary.activity} />}

        <View style={styles.spacerMedium} />

        {summary.vitals && <VitalsSection insight={summary.vitals} />}

        <View style={styles.spacerBottom} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  dateLabel: {
    fontSize: FontSize.footnote,
    fontWeight: FontWeight.regular,
    marginBottom: 2,
  },
  greeting: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.37,
  },
  emptyText: {
    fontSize: FontSize.subhead,
    textAlign: 'center',
    lineHeight: 22,
  },
  spacerLarge: {
    height: 20,
  },
  spacerMedium: {
    height: 12,
  },
  spacerBottom: {
    height: 32,
  },
});
