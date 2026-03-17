/**
 * Consent Section Component
 *
 * Displays a section of the consent document with
 * expandable content and read tracking.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  useColorScheme,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, StanfordColors, Spacing } from '@/constants/theme';

interface ConsentSectionProps {
  title: string;
  content: string;
  required?: boolean;
  isRead?: boolean;
  onRead?: () => void;
  defaultExpanded?: boolean;
}

export function ConsentSection({
  title,
  content,
  required = false,
  isRead = false,
  onRead,
  defaultExpanded = false,
}: ConsentSectionProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [expanded, setExpanded] = useState(defaultExpanded);
  const rotationAnim = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (!expanded && !isRead && onRead) {
      onRead();
    }

    setExpanded(!expanded);

    Animated.spring(rotationAnim, {
      toValue: expanded ? 0 : 1,
      useNativeDriver: true,
      tension: 50,
      friction: 10,
    }).start();
  };

  const rotateIcon = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // Parse markdown-like bold text
  const renderContent = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Text key={index} style={styles.bold}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      return part;
    });
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF',
          borderColor: isRead ? '#34C759' : colors.border,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.header}
        onPress={toggle}
        activeOpacity={0.7}
      >
        <View style={styles.titleContainer}>
          {required && (
            <View
              style={[
                styles.requiredBadge,
                { backgroundColor: isRead ? '#34C759' : StanfordColors.cardinal },
              ]}
            >
              <IconSymbol
                name={(isRead ? 'checkmark' : 'xmark.circle.fill') as any}
                size={10}
                color="#FFFFFF"
              />
            </View>
          )}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: rotateIcon }] }}>
          <IconSymbol name={'chevron.right' as any} size={20} color={colors.icon} />
        </Animated.View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <Text style={[styles.contentText, { color: colors.text }]}>
            {renderContent(content)}
          </Text>
          <TouchableOpacity
            style={styles.collapseButton}
            onPress={toggle}
            activeOpacity={0.7}
          >
            <Text style={[styles.collapseButtonText, { color: StanfordColors.cardinal }]}>
              Collapse
            </Text>
            <IconSymbol name={'chevron.up' as any} size={14} color={StanfordColors.cardinal} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/**
 * Consent Summary for final confirmation
 */
interface ConsentSummaryProps {
  summary: string;
  agreed: boolean;
  onToggle: () => void;
}

export function ConsentAgreement({ summary, agreed, onToggle }: ConsentSummaryProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View
      style={[
        styles.agreementContainer,
        {
          backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF',
          borderColor: agreed ? '#34C759' : colors.border,
        },
      ]}
    >
      <Text style={[styles.summaryText, { color: colors.text }]}>{summary}</Text>

      <TouchableOpacity
        style={styles.checkbox}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.checkboxBox,
            {
              backgroundColor: agreed ? '#34C759' : 'transparent',
              borderColor: agreed ? '#34C759' : colors.border,
            },
          ]}
        >
          {agreed && <IconSymbol name="checkmark" size={16} color="#FFFFFF" />}
        </View>
        <Text style={[styles.checkboxLabel, { color: colors.text }]}>
          I have read and agree to participate in this study
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  requiredBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingTop: 0,
  },
  contentText: {
    fontSize: 15,
    lineHeight: 22,
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  collapseButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bold: {
    fontWeight: '600',
  },
  agreementContainer: {
    borderRadius: 12,
    borderWidth: 2,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxLabel: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
});
