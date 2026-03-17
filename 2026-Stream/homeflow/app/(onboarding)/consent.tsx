/**
 * Consent Screen
 *
 * Formal informed consent document with required sections.
 * Users must scroll through and agree before proceeding.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Share,
  Linking,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter, Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, StanfordColors, Spacing } from '@/constants/theme';
import { STUDY_INFO, OnboardingStep } from '@/lib/constants';
import { OnboardingService } from '@/lib/services/onboarding-service';
import { ConsentService } from '@/lib/services/consent-service';
import {
  CONSENT_DOCUMENT,
  getConsentSummary,
} from '@/lib/consent/consent-document';
import {
  OnboardingProgressBar,
  ConsentAgreement,
  ContinueButton,
} from '@/components/onboarding';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SignaturePad, type SignaturePadRef } from '@/components/ui/SignaturePad';
import { useAuth } from '@/hooks/use-auth';

function buildConsentText(): string {
  const header = [
    CONSENT_DOCUMENT.title.toUpperCase(),
    CONSENT_DOCUMENT.studyName,
    `Institution: ${CONSENT_DOCUMENT.institution}`,
    `Principal Investigator: ${CONSENT_DOCUMENT.principalInvestigator}`,
    `IRB Protocol: ${CONSENT_DOCUMENT.irbProtocol}`,
    `Version: ${CONSENT_DOCUMENT.version}`,
    `Date Generated: ${new Date().toLocaleDateString()}`,
    '',
    '─'.repeat(40),
    '',
  ].join('\n');

  const body = CONSENT_DOCUMENT.sections
    .map(s =>
      [
        s.title.toUpperCase(),
        s.content.replace(/\*\*(.*?)\*\*/g, '$1'),
      ].join('\n'),
    )
    .join('\n\n');

  return header + body;
}

function renderConsentContent(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={index} style={{ fontWeight: '700' }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return part;
  });
}

export default function ConsentScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();

  const [agreed, setAgreed] = useState(false);
  const [signatureMode, setSignatureMode] = useState<'type' | 'draw'>('type');
  const [typedSignature, setTypedSignature] = useState('');
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailAddress, setEmailAddress] = useState(user?.email ?? '');
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const scrollViewRef = useRef<ScrollView>(null);
  const signaturePadRef = useRef<SignaturePadRef>(null);

  const signatureValid =
    signatureMode === 'type'
      ? typedSignature.trim().length > 0
      : hasDrawnSignature;

  const canContinue = agreed && signatureValid;

  const handleContinue = async () => {
    if (!canContinue) return;

    setIsSubmitting(true);

    try {
      const participantName =
        signatureMode === 'type' ? typedSignature.trim() : null;
      const signatureValue =
        signatureMode === 'type'
          ? typedSignature.trim()
          : '[Drawn signature provided]';

      // Record consent locally (source of truth for gate-keeping)
      await ConsentService.recordConsent(signatureValue);

      // Store signature data so account.tsx can upload the PDF after sign-in.
      // We can't upload now because the user isn't authenticated yet.
      await OnboardingService.updateData({
        pendingConsentPdf: {
          signatureType: signatureMode === 'type' ? 'typed' : 'drawn',
          participantName,
          signatureValue,
          consentDate: new Date().toISOString(),
        },
      });

      // Advance onboarding
      await OnboardingService.goToStep(OnboardingStep.ACCOUNT);
      router.push('/(onboarding)/account' as Href);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveToDevice = async () => {
    try {
      await Share.share({
        title: `${CONSENT_DOCUMENT.title} – ${CONSENT_DOCUMENT.studyName}`,
        message: buildConsentText(),
      });
    } catch {
      // user dismissed share sheet — no-op
    }
  };

  const handleEmailCopy = () => {
    // Reset to latest known email each time the modal opens
    setEmailAddress(user?.email ?? '');
    setEmailModalVisible(true);
  };

  const handleSendEmail = () => {
    const to = emailAddress.trim();
    if (!to) return;

    setEmailModalVisible(false);

    const subject = encodeURIComponent(
      `Your Informed Consent Copy – ${CONSENT_DOCUMENT.studyName}`,
    );

    const bodyLines = [
      `Dear Participant,`,
      ``,
      `This email confirms you have reviewed and signed the informed consent form for the ${CONSENT_DOCUMENT.studyName}.`,
      ``,
      `CONSENT DETAILS`,
      `Study: ${CONSENT_DOCUMENT.studyName}`,
      `Institution: ${CONSENT_DOCUMENT.institution}`,
      `Principal Investigator: ${CONSENT_DOCUMENT.principalInvestigator}`,
      `IRB Protocol: ${CONSENT_DOCUMENT.irbProtocol}`,
      `Consent Version: ${CONSENT_DOCUMENT.version}`,
      `Date Signed: ${new Date().toLocaleDateString()}`,
      ``,
      `If you have questions, contact the study team:`,
      `Email: ${STUDY_INFO.contactEmail}`,
      `Phone: ${STUDY_INFO.contactPhone}`,
      ``,
      `Thank you for participating in the ${CONSENT_DOCUMENT.studyName}.`,
    ];

    const body = encodeURIComponent(bodyLines.join('\n'));
    const mailto = `mailto:${to}?subject=${subject}&body=${body}`;

    Linking.openURL(mailto).catch(() => {
      Alert.alert(
        'Mail Not Available',
        'No email app is set up on this device. Use "Save to Device" to keep a copy instead.',
      );
    });
  };

  // Dev-only handler that bypasses consent validation
  const handleDevContinue = async () => {
    setIsSubmitting(true);

    try {
      await OnboardingService.goToStep(OnboardingStep.PERMISSIONS);
      router.push('/(onboarding)/permissions' as Href);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <OnboardingProgressBar currentStep={OnboardingStep.CONSENT} />
        <View style={styles.titleContainer}>
          <IconSymbol name="doc.text.fill" size={24} color={StanfordColors.cardinal} />
          <Text style={[styles.title, { color: colors.text }]}>
            {CONSENT_DOCUMENT.title}
          </Text>
        </View>
        <Text style={[styles.studyName, { color: colors.icon }]}>
          {CONSENT_DOCUMENT.studyName}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
      >
        {/* Flat consent document */}
        {CONSENT_DOCUMENT.sections.map((section, index) => (
          <View key={section.id}>
            {index > 0 && (
              <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
            )}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {section.title}
            </Text>
            <Text style={[styles.sectionContent, { color: colors.text }]}>
              {renderConsentContent(section.content)}
            </Text>
          </View>
        ))}

        <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />

        {/* Agreement checkbox */}
        <ConsentAgreement
          summary={getConsentSummary()}
          agreed={agreed}
          onToggle={() => setAgreed(!agreed)}
        />

        {/* Signature */}
        <View
          style={[
            styles.signatureContainer,
            {
              backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF',
              borderColor: signatureValid ? '#34C759' : colors.border,
            },
          ]}
        >
          <Text style={[styles.signatureLabel, { color: colors.text }]}>
            Signature
          </Text>

          {/* Type / Draw tab switcher */}
          <View style={[styles.modeTabs, { backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#F2F2F7' }]}>
            {(['type', 'draw'] as const).map(mode => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.modeTab,
                  signatureMode === mode && {
                    backgroundColor: colorScheme === 'dark' ? '#3A3A3C' : '#FFFFFF',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2,
                  },
                ]}
                onPress={() => setSignatureMode(mode)}
                activeOpacity={0.7}
              >
                <IconSymbol
                  name={mode === 'type' ? 'keyboard' : 'pencil.tip'}
                  size={14}
                  color={signatureMode === mode ? StanfordColors.cardinal : colors.icon}
                />
                <Text
                  style={[
                    styles.modeTabText,
                    { color: signatureMode === mode ? StanfordColors.cardinal : colors.icon },
                  ]}
                >
                  {mode === 'type' ? 'Type' : 'Draw'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Type mode */}
          {signatureMode === 'type' && (
            <TextInput
              style={[
                styles.signatureInput,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#F9F9F9',
                },
              ]}
              placeholder="Your full name"
              placeholderTextColor={colors.icon}
              value={typedSignature}
              onChangeText={setTypedSignature}
              autoCapitalize="words"
              autoCorrect={false}
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 300);
              }}
            />
          )}

          {/* Draw mode */}
          {signatureMode === 'draw' && (
            <View>
              <SignaturePad
                ref={signaturePadRef}
                onChanged={setHasDrawnSignature}
                onDrawingActiveChange={active => setScrollEnabled(!active)}
                strokeColor={colorScheme === 'dark' ? '#FFFFFF' : '#1A1A1A'}
                backgroundColor={colorScheme === 'dark' ? '#2C2C2E' : '#F9F9F9'}
                height={160}
              />
              {hasDrawnSignature && (
                <TouchableOpacity
                  style={styles.clearDrawButton}
                  onPress={() => {
                    signaturePadRef.current?.clear();
                    setHasDrawnSignature(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.clearDrawText, { color: colors.icon }]}>
                    Clear
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <Text style={[styles.signatureDate, { color: colors.icon }]}>
            Date: {new Date().toLocaleDateString()}
          </Text>
        </View>

        {/* Get a copy */}
        <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
        <View style={styles.copySection}>
          <Text style={[styles.copyTitle, { color: colors.text }]}>
            Get a Copy of This Form
          </Text>
          <Text style={[styles.copySubtitle, { color: colors.icon }]}>
            Save a personal copy of this consent document for your records.
          </Text>
          <View style={styles.copyButtons}>
            <TouchableOpacity
              style={[styles.copyButton, { borderColor: colors.border, backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF' }]}
              onPress={handleSaveToDevice}
              activeOpacity={0.75}
            >
              <IconSymbol name="arrow.down.doc.fill" size={20} color={StanfordColors.cardinal} />
              <Text style={[styles.copyButtonTitle, { color: colors.text }]}>Save to Device</Text>
              <Text style={[styles.copyButtonSub, { color: colors.icon }]}>Files, AirDrop & more</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.copyButton, { borderColor: colors.border, backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#FFFFFF' }]}
              onPress={handleEmailCopy}
              activeOpacity={0.75}
            >
              <IconSymbol name="envelope.fill" size={20} color={StanfordColors.cardinal} />
              <Text style={[styles.copyButtonTitle, { color: colors.text }]}>Email to Me</Text>
              <Text style={[styles.copyButtonSub, { color: colors.icon }]}>
                {user?.email ?? 'Opens Mail app'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { backgroundColor: colors.background }]}>
        {!canContinue && (
          <Text style={[styles.footerHint, { color: colors.icon }]}>
            Please agree and sign to continue
          </Text>
        )}
        <ContinueButton
          title="I Agree & Continue"
          onPress={handleContinue}
          disabled={!canContinue}
          loading={isSubmitting}
        />
      </View>

      {/* Email address prompt modal */}
      <Modal
        visible={emailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEmailModalVisible(false)}
      >
        <Pressable
          style={emailStyles.backdrop}
          onPress={() => setEmailModalVisible(false)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={emailStyles.sheetWrapper}
        >
          <View style={emailStyles.sheet}>
            <Text style={emailStyles.sheetTitle}>Email a Copy</Text>
            <Text style={emailStyles.sheetSubtitle}>
              Enter the address where you&apos;d like to receive your consent confirmation.
            </Text>

            <TextInput
              style={emailStyles.input}
              value={emailAddress}
              onChangeText={setEmailAddress}
              placeholder="your@email.com"
              placeholderTextColor="#AEAEB2"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={handleSendEmail}
            />

            <View style={emailStyles.row}>
              <TouchableOpacity
                style={emailStyles.cancelBtn}
                onPress={() => setEmailModalVisible(false)}
              >
                <Text style={emailStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  emailStyles.sendBtn,
                  !emailAddress.trim() && emailStyles.sendBtnDisabled,
                ]}
                onPress={handleSendEmail}
                disabled={!emailAddress.trim()}
              >
                <Text style={emailStyles.sendText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  studyName: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.screenHorizontal,
    paddingBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  sectionContent: {
    fontSize: 15,
    lineHeight: 23,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.lg,
  },
  signatureContainer: {
    borderRadius: 12,
    borderWidth: 2,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  signatureLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  signatureInput: {
    fontSize: 18,
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    fontStyle: 'italic',
  },
  signatureDate: {
    fontSize: 13,
    marginTop: Spacing.sm,
    textAlign: 'right',
  },
  modeTabs: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
    marginBottom: Spacing.sm,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 6,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clearDrawButton: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginTop: 6,
  },
  clearDrawText: {
    fontSize: 13,
    fontWeight: '500',
  },
  footer: {
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  footerHint: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  copySection: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  copyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  copySubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  copyButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  copyButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  copyButtonTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  copyButtonSub: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
});

const emailStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  sheetSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#F9F9F9',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  sendBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: StanfordColors.cardinal,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
