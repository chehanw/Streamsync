import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DurationBar } from './DurationBar';
import type { SleepInsight } from '@/lib/services/health-summary';
import { useAppTheme } from '@/lib/theme/ThemeContext';
import { FontSize, FontWeight } from '@/lib/theme/typography';

interface SleepSectionProps {
  insight: SleepInsight;
}

export function SleepSection({ insight }: SleepSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const { theme } = useAppTheme();
  const { isDark, colors: c } = theme;

  const accent = isDark ? '#BF5AF2' : '#AF52DE'; // systemPurple — sleep

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => setExpanded(!expanded)}
      style={[styles.card, { backgroundColor: c.card }]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <IconSymbol name="moon.fill" size={17} color={accent} />
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Sleep</Text>
        </View>
        <IconSymbol
          name="chevron.right"
          size={14}
          color={c.textTertiary}
          style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
        />
      </View>

      <Text style={[styles.headline, { color: c.textPrimary }]}>
        {insight.headline}
      </Text>
      <Text style={[styles.supporting, { color: c.textSecondary }]}>
        {insight.supportingText}
      </Text>

      {expanded && (
        <View style={styles.details}>
          <DurationBar
            fill={insight.barFill}
            valueLabel={`${insight.totalHours}h`}
            baselineLabel={`${insight.baselineHours}h avg`}
          />

          <Text style={[styles.detailRow, { color: c.textTertiary }]}>
            Sleep efficiency: {insight.efficiency}%
          </Text>

          {insight.stages && (
            <View style={styles.stagesContainer}>
              <Text style={[styles.detailRow, { color: c.textTertiary }]}>
                Deep: {insight.stages.deep} min
              </Text>
              <Text style={[styles.detailRow, { color: c.textTertiary }]}>
                Core: {insight.stages.core} min
              </Text>
              <Text style={[styles.detailRow, { color: c.textTertiary }]}>
                REM: {insight.stages.rem} min
              </Text>
              <Text style={[styles.detailRow, { color: c.textTertiary }]}>
                Awake: {insight.stages.awake} min
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    fontSize: FontSize.footnote,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.2,
  },
  headline: {
    fontSize: FontSize.titleSmall,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.38,
    marginBottom: 4,
  },
  supporting: {
    fontSize: FontSize.subhead,
    lineHeight: 22,
  },
  details: {
    marginTop: 16,
  },
  detailRow: {
    fontSize: FontSize.subhead,
    marginTop: 8,
  },
  stagesContainer: {
    marginTop: 4,
  },
});
