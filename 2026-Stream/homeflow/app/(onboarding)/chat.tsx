/**
 * Onboarding Eligibility Check Screen
 *
 * Structured eligibility questionnaire replacing the AI chat-based screening.
 * Medical history collection happens later (after consent & permissions)
 * in the medical-history screen.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter, Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, StanfordColors, Spacing } from '@/constants/theme';
import { OnboardingStep } from '@/lib/constants';
import { OnboardingService } from '@/lib/services/onboarding-service';
import { OnboardingProgressBar, ContinueButton } from '@/components/onboarding';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Lazy-load so the screen still renders even if the package isn't available
let DateTimePicker: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DateTimePicker = require('react-native-ui-datepicker').default;
} catch {
  // noop – graceful degradation below
}

type YesNo = 'yes' | 'no' | null;

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function OnboardingChatScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];

  const [bphDiagnosis, setBphDiagnosis] = useState<YesNo>(null);
  const [surgerySched, setSurgerySched] = useState<YesNo>(null);
  const [surgeryDate, setSurgeryDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const canContinue = bphDiagnosis === 'yes' && surgerySched === 'yes';

  const cardBg = isDark ? '#1C1C1E' : '#F2F2F7';
  const noButtonBg = isDark ? '#2C2C2E' : '#E5E5EA';
  const noButtonText = isDark ? '#EBEBF5' : '#3A3A3C';
  const dateInputBg = isDark ? '#2C2C2E' : '#E5E5EA';

  const handleBphSelect = (value: YesNo) => {
    setBphDiagnosis(value);
    if (value === 'no') {
      setTimeout(() => {
        router.replace('/(onboarding)/ineligible' as Href);
      }, 400);
    }
  };

  const handleSurgerySelect = (value: YesNo) => {
    setSurgerySched(value);
    if (value === 'no') {
      setTimeout(() => {
        router.replace('/(onboarding)/ineligible' as Href);
      }, 400);
    }
  };

  const handleContinue = async () => {
    const dateStr = surgerySched === 'yes'
      ? surgeryDate.toISOString().split('T')[0]
      : undefined;

    await OnboardingService.updateData({
      eligibility: {
        hasIPhone: true,
        hasBPHDiagnosis: bphDiagnosis === 'yes',
        consideringSurgery: surgerySched === 'yes',
        isEligible: canContinue,
        surgeryDate: dateStr,
      },
    });

    // Surgery date is persisted locally in OnboardingService (AsyncStorage).
    // It will be flushed to Firestore after the user logs in (account.tsx).

    await OnboardingService.goToStep(OnboardingStep.CONSENT);
    router.push('/(onboarding)/consent' as Href);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.progressHeader}>
        <OnboardingProgressBar currentStep={OnboardingStep.CHAT} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={styles.titleRow}>
          <View style={styles.iconCircle}>
            <IconSymbol name={'checkmark' as any} size={22} color="#FFFFFF" />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Eligibility Check</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.icon }]}>
          Let&apos;s make sure this study is right for you
        </Text>

        {/* ── Q1: BPH Diagnosis ── */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.questionText, { color: colors.text }]}>
            Have you been diagnosed with BPH (Benign Prostatic Hyperplasia)?
          </Text>
          <View style={styles.yesNoRow}>
            <YesNoButton
              label="Yes"
              selected={bphDiagnosis === 'yes'}
              onPress={() => handleBphSelect('yes')}
              selectedBg={StanfordColors.cardinal}
              unselectedBg={noButtonBg}
              unselectedText={noButtonText}
            />
            <YesNoButton
              label="No"
              selected={bphDiagnosis === 'no'}
              onPress={() => handleBphSelect('no')}
              selectedBg={StanfordColors.cardinal}
              unselectedBg={noButtonBg}
              unselectedText={noButtonText}
            />
          </View>
        </View>

        {/* ── Q2: Surgery Scheduled ── */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.questionText, { color: colors.text }]}>
            Do you have a scheduled bladder outlet surgery?
          </Text>
          <Text style={[styles.questionSubtext, { color: colors.icon }]}>
            Such as TURP, HoLEP, GreenLight laser, UroLift, Rezum, or Aquablation
          </Text>
          <View style={styles.yesNoRow}>
            <YesNoButton
              label="Yes"
              selected={surgerySched === 'yes'}
              onPress={() => handleSurgerySelect('yes')}
              selectedBg={StanfordColors.cardinal}
              unselectedBg={noButtonBg}
              unselectedText={noButtonText}
            />
            <YesNoButton
              label="No"
              selected={surgerySched === 'no'}
              onPress={() => handleSurgerySelect('no')}
              selectedBg={StanfordColors.cardinal}
              unselectedBg={noButtonBg}
              unselectedText={noButtonText}
            />
          </View>
        </View>

        {/* ── Q3: Surgery Date (shown when surgery is confirmed) ── */}
        {surgerySched === 'yes' && (
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <Text style={[styles.questionText, { color: colors.text }]}>
              When is your surgery scheduled?
            </Text>

            {/* Tappable date display row */}
            <TouchableOpacity
              style={[styles.dateInput, { backgroundColor: dateInputBg }]}
              onPress={() => setShowDatePicker((prev) => !prev)}
              activeOpacity={0.7}
            >
              <IconSymbol name={'calendar' as any} size={20} color={colors.icon} />
              <Text style={[styles.dateText, { color: colors.text }]}>
                {formatDate(surgeryDate)}
              </Text>
              <IconSymbol
                name={(showDatePicker ? 'chevron.up' : 'chevron.down') as any}
                size={14}
                color={colors.icon}
              />
            </TouchableOpacity>

            {/* Inline calendar */}
            {showDatePicker && (
              <View style={styles.calendarWrap}>
                {DateTimePicker ? (
                  <DateTimePicker
                    mode="single"
                    date={surgeryDate}
                    onChange={({ date }: { date: any }) => {
                      if (date) {
                        // react-native-ui-datepicker returns a Dayjs object,
                        // not a native Date. Convert via valueOf() (epoch ms).
                        const nativeDate =
                          date instanceof Date
                            ? date
                            : new Date(typeof date.valueOf === 'function' ? date.valueOf() : date);
                        setSurgeryDate(nativeDate);
                        setShowDatePicker(false);
                      }
                    }}
                    styles={{
                      // Day grid
                      day_label:            { color: colors.text },
                      outside_label:        { color: colors.icon },
                      disabled_label:       { color: colors.icon, opacity: 0.35 },
                      // Weekday header row
                      weekday_label:        { color: colors.icon },
                      // Month / year selectors in header
                      month_selector_label: { color: colors.text, fontWeight: '600' },
                      year_selector_label:  { color: colors.text, fontWeight: '600' },
                      // Today highlight (unfilled ring)
                      today:                { borderWidth: 1, borderColor: StanfordColors.cardinal, borderRadius: 999 },
                      today_label:          { color: StanfordColors.cardinal },
                      // Selected day — filled cardinal circle
                      selected:             { backgroundColor: StanfordColors.cardinal, borderRadius: 999 },
                      selected_label:       { color: '#FFFFFF', fontWeight: '600' },
                    }}
                  />
                ) : (
                  <Text style={[styles.pickerFallback, { color: colors.icon }]}>
                    Date picker not available. Install react-native-ui-datepicker.
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Footer CTA ── */}
      <View style={[styles.footer, { borderTopColor: isDark ? '#2C2C2E' : 'rgba(0,0,0,0.1)' }]}>
        <ContinueButton
          title="Continue to Consent"
          onPress={handleContinue}
          disabled={!canContinue}
        />
      </View>

    </SafeAreaView>
  );
}

// ─── Sub-component ───────────────────────────────────────────────────────────

interface YesNoButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  selectedBg: string;
  unselectedBg: string;
  unselectedText: string;
}

function YesNoButton({ label, selected, onPress, selectedBg, unselectedBg, unselectedText }: YesNoButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.yesNoBtn,
        { backgroundColor: selected ? selectedBg : unselectedBg },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.yesNoBtnText, { color: selected ? '#FFFFFF' : unselectedText }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  progressHeader: {
    paddingTop: Spacing.sm,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },

  // Header
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: Spacing.xs,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: StanfordColors.cardinal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },

  // Question cards
  card: {
    borderRadius: 16,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  questionSubtext: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -Spacing.sm,
  },

  // Yes/No buttons
  yesNoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  yesNoBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yesNoBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Date input
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  dateText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  calendarWrap: {
    marginTop: -Spacing.sm,
  },
  pickerFallback: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },

  // Footer
  footer: {
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
