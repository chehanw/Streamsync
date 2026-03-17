import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '@/lib/theme/ThemeContext';

interface DurationBarProps {
  fill: number;
  valueLabel: string;
  baselineLabel: string;
}

export function DurationBar({ fill, valueLabel, baselineLabel }: DurationBarProps) {
  const { theme } = useAppTheme();
  const { isDark, colors: c } = theme;
  const clampedFill = Math.max(0, Math.min(fill, 1));

  const trackBg = isDark ? '#38383A' : '#E5E5EA';    // systemFill
  const fillBg = isDark ? '#BF5AF2' : '#AF52DE';      // systemPurple (matches sleep)

  return (
    <View style={styles.container}>
      <View style={[styles.track, { backgroundColor: trackBg }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: fillBg, width: `${clampedFill * 100}%` },
          ]}
        />
      </View>
      <View style={styles.labels}>
        <Text style={[styles.label, { color: c.textTertiary }]}>{valueLabel}</Text>
        <Text style={[styles.label, { color: c.textTertiary }]}>{baselineLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  label: {
    fontSize: 13,
  },
});
