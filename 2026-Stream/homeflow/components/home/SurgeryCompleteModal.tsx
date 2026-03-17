/**
 * Surgery Complete Modal
 *
 * A calm, full-screen modal shown when the surgery date has passed.
 * Can also be triggered via dev tools for demo purposes.
 */

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppTheme } from '@/lib/theme/ThemeContext';
import { FontSize, FontWeight } from '@/lib/theme/typography';

interface SurgeryCompleteModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function SurgeryCompleteModal({ visible, onDismiss }: SurgeryCompleteModalProps) {
  const { theme } = useAppTheme();
  const { isDark, colors: c } = theme;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.96);
    }
  }, [visible, fadeAnim, scaleAnim]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onDismiss}
    >
      <View style={[styles.overlay, isDark && styles.overlayDark]}>
        <Animated.View
          style={[
            styles.content,
            { backgroundColor: c.card },
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: c.background }]}>
            <IconSymbol
              name="checkmark.circle.fill"
              size={48}
              color={c.semanticSuccess}
            />
          </View>

          <Text style={[styles.title, { color: c.textPrimary }]}>
            Surgery Complete
          </Text>

          <Text style={[styles.body, { color: c.textSecondary }]}>
            {"You've reached an important milestone in your care journey. We'll continue tracking your recovery patterns so your care team can support you."}
          </Text>

          <Text style={[styles.subtext, { color: c.textTertiary }]}>
            Your daily check-ins will now focus on recovery.
          </Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: c.accent }]}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>
              Continue
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  overlayDark: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  content: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    padding: 32,
    borderRadius: 14,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: FontSize.titleMedium,
    fontWeight: FontWeight.bold,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.35,
  },
  body: {
    fontSize: FontSize.subhead,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    fontSize: FontSize.footnote,
    textAlign: 'center',
    marginBottom: 28,
  },
  button: {
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: FontSize.headline,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
});
