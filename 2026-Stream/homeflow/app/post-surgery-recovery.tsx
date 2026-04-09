/**
 * Post-Surgery Recovery Screen
 *
 * Walks patients through their recovery after HoLEP surgery using the official
 * Stanford Urology discharge instructions. Purely instructional — no medical
 * decision logic, no backend changes.
 *
 * Route: /post-surgery-recovery
 */

import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAppTheme } from '@/lib/theme/ThemeContext';
import { useSurgeryDate } from '@/hooks/use-surgery-date';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  AccordionSection,
  BulletItem,
  StepItem,
} from '@/components/ui/AccordionSection';

// ─── Constants ────────────────────────────────────────────────────────────────

const UROLOGY_PHONE = '6507233391';
const UROLOGY_PHONE_DISPLAY = '650-723-3391';

// ─── Progress Timeline ────────────────────────────────────────────────────────

function RecoveryTimeline({ surgeryDateStr }: { surgeryDateStr: string }) {
  const { theme } = useAppTheme();
  const { colors: c } = theme;

  const surgeryDate = new Date(surgeryDateStr + 'T12:00:00');
  const now = new Date();
  const daysPost = Math.floor(
    (now.getTime() - surgeryDate.getTime()) / (24 * 60 * 60 * 1000),
  );
  const clampedDays = Math.max(0, Math.min(daysPost, 42));
  const progressPct = (clampedDays / 42) * 100;

  const milestones = [
    { label: 'Surgery', day: 0 },
    { label: 'Wk 1–2', day: 14 },
    { label: '6-wk Appt', day: 42 },
  ];

  const statusLabel =
    daysPost < 0
      ? 'Surgery upcoming'
      : daysPost === 0
      ? 'Day of surgery'
      : daysPost === 1
      ? '1 day post-op'
      : `Day ${daysPost} post-op`;

  return (
    <View style={[timelineStyles.card, { backgroundColor: c.card }]}>
      <View style={timelineStyles.statusRow}>
        <Text style={[timelineStyles.statusLabel, { color: c.textPrimary }]}>
          {statusLabel}
        </Text>
        {daysPost >= 0 && daysPost <= 42 && (
          <Text style={[timelineStyles.statusSub, { color: c.textSecondary }]}>
            {42 - daysPost} days to follow-up
          </Text>
        )}
      </View>

      {/* Progress bar */}
      <View style={[timelineStyles.track, { backgroundColor: c.secondaryFill }]}>
        <View
          style={[
            timelineStyles.fill,
            { width: `${progressPct}%` as `${number}%`, backgroundColor: c.accent },
          ]}
        />
      </View>

      {/* Milestone labels */}
      <View style={timelineStyles.milestonesRow}>
        {milestones.map(m => {
          const pct = (m.day / 42) * 100;
          const reached = clampedDays >= m.day;
          return (
            <View key={m.day} style={[timelineStyles.milestone, { left: `${pct}%` as `${number}%` }]}>
              <View
                style={[
                  timelineStyles.dot,
                  {
                    backgroundColor: reached ? c.accent : c.secondaryFill,
                    borderColor: reached ? c.accent : c.textTertiary,
                  },
                ]}
              />
              <Text
                style={[
                  timelineStyles.milestoneLabel,
                  { color: reached ? c.textPrimary : c.textTertiary },
                ]}
              >
                {m.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const timelineStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusSub: {
    fontSize: 12,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 24,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  milestonesRow: {
    position: 'relative',
    height: 32,
  },
  milestone: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -20 }],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    marginBottom: 4,
  },
  milestoneLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    width: 48,
  },
});

// ─── Section: Diet & Activity ─────────────────────────────────────────────────

function DietActivityContent() {
  const { theme } = useAppTheme();
  const { colors: c } = theme;

  return (
    <View style={{ gap: 4 }}>
      <Text style={[sectionStyles.groupLabel, { color: c.textSecondary }]}>Diet</Text>
      <BulletItem>Resume your regular diet.</BulletItem>
      <BulletItem>Encourage well-balanced, nutritious meals.</BulletItem>

      <View style={sectionStyles.divider} />

      <Text style={[sectionStyles.groupLabel, { color: c.textSecondary }]}>Activity</Text>
      <BulletItem>
        <Text style={{ fontWeight: '600' }}>No strenuous activity</Text> or heavy lifting
        over 10 lbs until your follow-up appointment.
      </BulletItem>
      <BulletItem>Walk daily as tolerated — gentle movement supports recovery.</BulletItem>
      <BulletItem>
        <Text style={{ fontWeight: '600' }}>Do not drive</Text> while taking narcotic pain
        medications.
      </BulletItem>
      <BulletItem>Avoid excessive straining during bowel movements.</BulletItem>
      <BulletItem>Use stool softeners as directed to reduce straining.</BulletItem>
    </View>
  );
}

// ─── Section: Catheter Care ───────────────────────────────────────────────────

function CatheterContent() {
  const { theme } = useAppTheme();
  const { colors: c } = theme;

  return (
    <View style={{ gap: 4 }}>
      <View style={[sectionStyles.infoBox, { backgroundColor: c.accent + '12', borderColor: c.accent + '30' }]}>
        <IconSymbol name="info.circle.fill" size={14} color={c.accent} />
        <Text style={[sectionStyles.infoText, { color: c.textSecondary }]}>
          A Foley catheter is in place to help your bladder heal. It will be removed by your
          care team approximately 1 day after surgery.
        </Text>
      </View>

      <Text style={[sectionStyles.groupLabel, { color: c.textSecondary }]}>Daily Use</Text>
      <BulletItem>Use a leg bag during the day and while showering for comfort.</BulletItem>
      <BulletItem>Switch to the long tubing and bag overnight.</BulletItem>
      <BulletItem>
        Secure the catheter with a strap or StatLock to prevent accidental pulling.
      </BulletItem>

      <View style={sectionStyles.divider} />

      <Text style={[sectionStyles.groupLabel, { color: c.textSecondary }]}>Balloon Removal</Text>
      <StepItem number={1}>
        Use a syringe to deflate the balloon fully before attempting removal.
      </StepItem>
      <StepItem number={2}>
        Up to 80 mL of fluid may need to be withdrawn from the balloon.
      </StepItem>
      <StepItem number={3}>
        Remove the catheter gently only after the balloon is completely deflated.
      </StepItem>
    </View>
  );
}

// ─── Section: Medications ────────────────────────────────────────────────────

function MedicationsContent() {
  const { theme } = useAppTheme();
  const { colors: c } = theme;

  return (
    <View style={{ gap: 4 }}>
      <Text style={[sectionStyles.groupLabel, { color: c.textSecondary }]}>Pain Management</Text>
      <BulletItem>
        <Text style={{ fontWeight: '600' }}>Acetaminophen (Tylenol)</Text> — first-line for
        mild to moderate pain.
      </BulletItem>
      <BulletItem>
        <Text style={{ fontWeight: '600' }}>Ibuprofen (Advil, Motrin)</Text> — anti-inflammatory,
        use as directed.
      </BulletItem>
      <BulletItem>
        <Text style={{ fontWeight: '600' }}>Tramadol</Text> — for severe pain only, as prescribed.
        Do not drive while taking.
      </BulletItem>

      <View style={sectionStyles.divider} />

      <Text style={[sectionStyles.groupLabel, { color: c.textSecondary }]}>Stool Softeners</Text>
      <BulletItem>
        Options include: Colace, MiraLax, Senna, Dulcolax, or Milk of Magnesia.
      </BulletItem>
      <BulletItem>
        <Text style={{ fontWeight: '600' }}>Stop if loose stools develop.</Text>
      </BulletItem>
    </View>
  );
}

// ─── Section: Pelvic Floor (Kegel) ───────────────────────────────────────────

function PelvicFloorContent({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  const { theme } = useAppTheme();
  const { colors: c } = theme;

  return (
    <View style={{ gap: 4 }}>
      <View style={[sectionStyles.infoBox, { backgroundColor: c.accent + '12', borderColor: c.accent + '30' }]}>
        <IconSymbol name="info.circle.fill" size={14} color={c.accent} />
        <Text style={[sectionStyles.infoText, { color: c.textSecondary }]}>
          Temporary urinary incontinence is common after HoLEP. Kegel exercises strengthen the
          pelvic floor muscles and help restore control. You should notice improvement
          over weeks of consistent practice.
        </Text>
      </View>

      <Text style={[sectionStyles.groupLabel, { color: c.textSecondary }]}>How to do them</Text>
      <BulletItem>
        Identify the muscles you use to stop the flow of urine or hold back gas.
      </BulletItem>
      <StepItem number={1}>
        Squeeze (contract) those pelvic floor muscles firmly.
      </StepItem>
      <StepItem number={2}>
        Hold for 3 seconds. Build up to 10 seconds over time.
      </StepItem>
      <StepItem number={3}>
        Release fully and rest for a moment.
      </StepItem>
      <StepItem number={4}>
        Repeat 10 times per session, 3–8 sessions daily.
      </StepItem>

      <View style={sectionStyles.divider} />

      <BulletItem>
        <Text style={{ fontWeight: '600' }}>Stop immediately</Text> if exercises cause pain.
      </BulletItem>
      <BulletItem>
        Seek guidance from your care team if there is no improvement after several weeks.
      </BulletItem>

      {/* Local-state practice tracker */}
      <Pressable
        onPress={onToggle}
        style={[
          sectionStyles.checkRow,
          {
            backgroundColor: checked ? c.accent + '15' : c.secondaryFill,
            borderColor: checked ? c.accent + '40' : 'transparent',
          },
        ]}
      >
        <View
          style={[
            sectionStyles.checkbox,
            {
              backgroundColor: checked ? c.accent : 'transparent',
              borderColor: checked ? c.accent : c.textTertiary,
            },
          ]}
        >
          {checked && <IconSymbol name="checkmark" size={11} color="#FFFFFF" />}
        </View>
        <Text style={[sectionStyles.checkLabel, { color: checked ? c.accent : c.textSecondary }]}>
          {checked ? 'Practicing today' : 'Mark as practicing today'}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Section: Warning Signs ───────────────────────────────────────────────────

function WarningSignsContent() {
  const { theme } = useAppTheme();
  const { colors: c } = theme;
  const amber = theme.isDark ? '#FF9F0A' : '#FF9500';

  return (
    <View style={{ gap: 4 }}>
      <View
        style={[
          sectionStyles.infoBox,
          { backgroundColor: amber + '15', borderColor: amber + '35' },
        ]}
      >
        <IconSymbol name="exclamationmark.triangle.fill" size={14} color={amber} />
        <Text style={[sectionStyles.infoText, { color: c.textPrimary }]}>
          <Text style={{ fontWeight: '600' }}>
            Call the clinic or go to the emergency room
          </Text>{' '}
          if you experience any of the following:
        </Text>
      </View>

      <BulletItem>Fever above 101°F (38.3°C)</BulletItem>
      <BulletItem>Chills</BulletItem>
      <BulletItem>Nausea or vomiting</BulletItem>
      <BulletItem>Large blood clots that are preventing urination</BulletItem>
      <BulletItem>Pain that is getting worse, not better</BulletItem>
      <BulletItem>Abdominal swelling or distension</BulletItem>
      <BulletItem>Severe bleeding</BulletItem>
      <BulletItem>Inability to urinate</BulletItem>

      <View style={sectionStyles.divider} />

      <Text style={[sectionStyles.groupLabel, { color: c.textSecondary }]}>What is normal</Text>
      <BulletItem>
        Some blood in the urine for <Text style={{ fontWeight: '600' }}>up to 2 weeks</Text> is
        expected and normal.
      </BulletItem>
      <BulletItem>
        Urine may clear and then become pink or red again — this is common and often
        activity-related.
      </BulletItem>
    </View>
  );
}

// ─── Section: Follow-Up ───────────────────────────────────────────────────────

function FollowUpContent() {
  const { theme } = useAppTheme();
  const { colors: c } = theme;

  return (
    <View style={{ gap: 8 }}>
      <BulletItem>Schedule your appointment approximately 6 weeks after surgery.</BulletItem>
      <BulletItem>
        Call the Stanford Urology clinic to book:{' '}
        <Text style={{ fontWeight: '600' }}>{UROLOGY_PHONE_DISPLAY}</Text>
      </BulletItem>

      <Pressable
        onPress={() => Linking.openURL(`tel:${UROLOGY_PHONE}`)}
        style={[sectionStyles.callButton, { backgroundColor: c.accent }]}
        accessibilityRole="button"
        accessibilityLabel="Call Urology Clinic"
      >
        <IconSymbol name="phone.fill" size={15} color="#FFFFFF" />
        <Text style={sectionStyles.callButtonText}>Call Urology Clinic</Text>
      </Pressable>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PostSurgeryRecoveryScreen() {
  const { theme } = useAppTheme();
  const { isDark, colors: c } = theme;
  const surgery = useSurgeryDate();

  // Local state for optional section interactions
  const [kegelChecked, setKegelChecked]       = useState(false);
  const [reviewedSections, setReviewedSections] = useState<Set<string>>(new Set());

  function markReviewed(section: string) {
    setReviewedSections(prev => new Set(prev).add(section));
  }

  const amber = isDark ? '#FF9F0A' : '#FF9500';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: c.background }]}
      edges={['top']}
    >
      {/* ── Nav bar ──────────────────────────────────────────────────────── */}
      <View style={styles.navBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[styles.backLabel, { color: c.accent }]}>‹ Back</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={styles.headerSection}>
          <Text style={[styles.title, { color: c.textPrimary }]}>Your Recovery Plan</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            Guidance for healing after your HoLEP procedure
          </Text>
          <Text style={[styles.sourceNote, { color: c.textTertiary }]}>
            Stanford Urology · Official Discharge Instructions
          </Text>
        </View>

        {/* ── Progress Timeline (only when surgery date exists + past) ── */}
        {surgery.date && surgery.hasPassed && !surgery.isPlaceholder && (
          <RecoveryTimeline surgeryDateStr={surgery.date} />
        )}

        {/* ── Section Cards ─────────────────────────────────────────── */}

        {/* 1. Diet & Activity */}
        <AccordionSection
          icon="fork.knife"
          iconColor={isDark ? '#34C759' : '#28A745'}
          title="Diet & Activity"
          summary="Regular diet · walk daily · no heavy lifting"
        >
          <DietActivityContent />
          <ReviewedToggle
            id="diet"
            reviewed={reviewedSections.has('diet')}
            onMark={() => markReviewed('diet')}
            c={c}
          />
        </AccordionSection>

        {/* 2. Catheter Care */}
        <AccordionSection
          icon="bandage.fill"
          iconColor={isDark ? '#5E9EFF' : '#2E7CF6'}
          title="Catheter Care"
          summary="Foley catheter · leg bag · removal in ~1 day"
        >
          <CatheterContent />
          <ReviewedToggle
            id="catheter"
            reviewed={reviewedSections.has('catheter')}
            onMark={() => markReviewed('catheter')}
            c={c}
          />
        </AccordionSection>

        {/* 3. Medications */}
        <AccordionSection
          icon="pills.fill"
          iconColor={isDark ? '#BF5AF2' : '#AF52DE'}
          title="Medications"
          summary="Tylenol · Ibuprofen · Tramadol · stool softeners"
        >
          <MedicationsContent />
          <ReviewedToggle
            id="medications"
            reviewed={reviewedSections.has('medications')}
            onMark={() => markReviewed('medications')}
            c={c}
          />
        </AccordionSection>

        {/* 4. Kegel / Pelvic Floor */}
        <AccordionSection
          icon="figure.strengthtraining.traditional"
          iconColor={isDark ? '#5E9EFF' : '#2E7CF6'}
          title="Pelvic Floor Exercises"
          summary="10 reps · 3–8 sessions daily · temporary incontinence is normal"
        >
          <PelvicFloorContent
            checked={kegelChecked}
            onToggle={() => setKegelChecked(v => !v)}
          />
          <ReviewedToggle
            id="kegel"
            reviewed={reviewedSections.has('kegel')}
            onMark={() => markReviewed('kegel')}
            c={c}
          />
        </AccordionSection>

        {/* 5. Warning Signs — amber tinted card */}
        <AccordionSection
          icon="exclamationmark.triangle.fill"
          iconColor={amber}
          title="When to Call or Seek Care"
          summary="Fever · inability to urinate · severe bleeding → call clinic or ER"
          tintColor={isDark ? '#2A2200' : '#FFFBF0'}
        >
          <WarningSignsContent />
          <ReviewedToggle
            id="warning"
            reviewed={reviewedSections.has('warning')}
            onMark={() => markReviewed('warning')}
            c={c}
          />
        </AccordionSection>

        {/* 6. Follow-Up */}
        <AccordionSection
          icon="phone.fill"
          iconColor={isDark ? '#34C759' : '#28A745'}
          title="Follow-Up Appointment"
          summary="Schedule in ~6 weeks · call 650-723-3391"
        >
          <FollowUpContent />
          <ReviewedToggle
            id="followup"
            reviewed={reviewedSections.has('followup')}
            onMark={() => markReviewed('followup')}
            c={c}
          />
        </AccordionSection>

        {/* ── Footer Actions ────────────────────────────────────────── */}
        <View style={[styles.footerCard, { backgroundColor: c.card }]}>
          <Text style={[styles.footerTitle, { color: c.textPrimary }]}>
            Have a question?
          </Text>
          <Text style={[styles.footerBody, { color: c.textSecondary }]}>
            Your care team is here to help. You can also use the built-in
            assistant for general guidance.
          </Text>
          <View style={styles.footerButtons}>
            <Pressable
              onPress={() => router.push('/(tabs)/chat')}
              style={[styles.footerBtn, { backgroundColor: c.accent }]}
              accessibilityRole="button"
            >
              <IconSymbol name="message.fill" size={14} color="#FFFFFF" />
              <Text style={styles.footerBtnText}>Ask Assistant</Text>
            </Pressable>
            <Pressable
              onPress={() => Linking.openURL(`tel:${UROLOGY_PHONE}`)}
              style={[styles.footerBtn, styles.footerBtnOutline, { borderColor: c.accent + '60' }]}
              accessibilityRole="button"
            >
              <IconSymbol name="phone.fill" size={14} color={c.accent} />
              <Text style={[styles.footerBtnText, { color: c.accent }]}>Call Clinic</Text>
            </Pressable>
          </View>
        </View>

        <Text style={[styles.disclaimer, { color: c.textTertiary }]}>
          This information is for educational purposes only and does not constitute medical
          advice. Always follow your care team&apos;s specific instructions.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── ReviewedToggle helper (local-only checkbox per section) ─────────────────

function ReviewedToggle({
  id,
  reviewed,
  onMark,
  c,
}: {
  id: string;
  reviewed: boolean;
  onMark: () => void;
  c: ReturnType<typeof useAppTheme>['theme']['colors'];
}) {
  if (reviewed) {
    return (
      <View style={[reviewStyles.done, { backgroundColor: c.semanticSuccess + '15' }]}>
        <IconSymbol name="checkmark.circle.fill" size={13} color={c.semanticSuccess} />
        <Text style={[reviewStyles.doneText, { color: c.semanticSuccess }]}>Section reviewed</Text>
      </View>
    );
  }

  return (
    <Pressable onPress={onMark} style={reviewStyles.btn}>
      <Text style={[reviewStyles.btnText, { color: c.textTertiary }]}>
        Mark section as reviewed
      </Text>
    </Pressable>
  );
}

const reviewStyles = StyleSheet.create({
  btn:      { paddingTop: 10, alignItems: 'center' },
  btnText:  { fontSize: 12, fontWeight: '500' },
  done:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
              paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  doneText: { fontSize: 12, fontWeight: '600' },
});

// ─── Shared section sub-styles (used across section components) ───────────────

const sectionStyles = StyleSheet.create({
  groupLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
    marginBottom: 6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#3C3C4333',
    marginVertical: 10,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 4,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

// ─── Main screen styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backLabel: {
    fontSize: 17,
    fontWeight: '400',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  // Header
  headerSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  sourceNote: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Footer card
  footerCard: {
    borderRadius: 14,
    padding: 16,
    marginTop: 6,
    marginBottom: 12,
  },
  footerTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  footerBody: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
  },
  footerBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  footerBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Disclaimer
  disclaimer: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
});
