/**
 * AccordionSection
 *
 * Themed, animated accordion card used across the app for structured
 * instructional content. Follows the HomeFlow useAppTheme() pattern.
 *
 * Usage:
 *   <AccordionSection icon="heart.fill" title="Activity" summary="Walk daily">
 *     <Text>…content…</Text>
 *   </AccordionSection>
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { useAppTheme } from '@/lib/theme/ThemeContext';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { FontSize, FontWeight } from '@/lib/theme/typography';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccordionSectionProps {
  /** SF Symbol name for the section icon. */
  icon: IconSymbolName;
  /** Override accent color for the icon. Defaults to theme accent. */
  iconColor?: string;
  /** Section title. */
  title: string;
  /** One-line summary shown while the section is collapsed. */
  summary?: string;
  /** Card background tint (e.g. a soft amber for warnings). */
  tintColor?: string;
  /** Whether the section starts open. Default false. */
  initiallyOpen?: boolean;
  /** Right-side badge text (e.g. "3 steps"). */
  badge?: string;
  children: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AccordionSection({
  icon,
  iconColor,
  title,
  summary,
  tintColor,
  initiallyOpen = false,
  badge,
  children,
}: AccordionSectionProps) {
  const { theme } = useAppTheme();
  const { colors: c } = theme;

  const [open, setOpen] = useState(initiallyOpen);
  const rotation = useRef(new Animated.Value(initiallyOpen ? 1 : 0)).current;

  const ic = iconColor ?? c.accent;
  const cardBg = tintColor ?? c.card;

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotation, {
      toValue: open ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setOpen(v => !v);
  }

  const chevronStyle = {
    transform: [
      {
        rotate: rotation.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '90deg'],
        }),
      },
    ],
  };

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      {/* Header row — always visible */}
      <Pressable
        onPress={toggle}
        style={styles.header}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${open ? 'collapse' : 'expand'}`}
      >
        {/* Icon bubble */}
        <View style={[styles.iconBubble, { backgroundColor: `${ic}18` }]}>
          <IconSymbol name={icon} size={17} color={ic} />
        </View>

        {/* Title + summary */}
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: c.textPrimary }]}>{title}</Text>
          {summary && !open && (
            <Text
              style={[styles.summary, { color: c.textSecondary }]}
              numberOfLines={1}
            >
              {summary}
            </Text>
          )}
        </View>

        {/* Badge */}
        {badge && !open && (
          <View style={[styles.badge, { backgroundColor: c.secondaryFill }]}>
            <Text style={[styles.badgeText, { color: c.textTertiary }]}>{badge}</Text>
          </View>
        )}

        {/* Chevron */}
        <Animated.View style={chevronStyle}>
          <IconSymbol name="chevron.right" size={13} color={c.textTertiary} />
        </Animated.View>
      </Pressable>

      {/* Expandable content */}
      {open && (
        <View style={[styles.content, { borderTopColor: c.separator }]}>
          {children}
        </View>
      )}
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * A simple bullet row for use inside AccordionSection content.
 *
 * <BulletItem>Walk daily as tolerated.</BulletItem>
 */
export function BulletItem({
  children,
  indent = false,
}: {
  children: React.ReactNode;
  indent?: boolean;
}) {
  const { theme } = useAppTheme();
  const { colors: c } = theme;

  return (
    <View style={[bulletStyles.row, indent && bulletStyles.indented]}>
      <Text style={[bulletStyles.dot, { color: c.textTertiary }]}>•</Text>
      <Text style={[bulletStyles.text, { color: c.textPrimary }]}>{children}</Text>
    </View>
  );
}

/**
 * A numbered step row for use inside AccordionSection content.
 *
 * <StepItem number={1}>Squeeze pelvic floor muscles.</StepItem>
 */
export function StepItem({
  number,
  children,
}: {
  number: number;
  children: React.ReactNode;
}) {
  const { theme } = useAppTheme();
  const { colors: c } = theme;

  return (
    <View style={stepStyles.row}>
      <View style={[stepStyles.numBubble, { backgroundColor: c.accent + '22' }]}>
        <Text style={[stepStyles.num, { color: c.accent }]}>{number}</Text>
      </View>
      <Text style={[stepStyles.text, { color: c.textPrimary }]}>{children}</Text>
    </View>
  );
}

/**
 * A labeled info row (label: value) for structured data like medication names.
 */
export function InfoPair({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { theme } = useAppTheme();
  const { colors: c } = theme;

  return (
    <View style={pairStyles.row}>
      <Text style={[pairStyles.label, { color: c.textSecondary }]}>{label}</Text>
      <Text style={[pairStyles.value, { color: c.textPrimary }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: FontSize.subhead,
    fontWeight: FontWeight.semibold,
    letterSpacing: -0.1,
  },
  summary: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.regular,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.medium,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
});

const bulletStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 5,
  },
  indented: {
    paddingLeft: 16,
  },
  dot: {
    fontSize: FontSize.footnote,
    lineHeight: 20,
    width: 12,
  },
  text: {
    fontSize: FontSize.footnote,
    lineHeight: 20,
    flex: 1,
  },
});

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  numBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  num: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.bold,
  },
  text: {
    fontSize: FontSize.footnote,
    lineHeight: 20,
    flex: 1,
  },
});

const pairStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 8,
  },
  label: {
    fontSize: FontSize.footnote,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  value: {
    fontSize: FontSize.footnote,
    fontWeight: FontWeight.regular,
    flex: 2,
    textAlign: 'right',
  },
});
