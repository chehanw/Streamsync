/**
 * Permissions Screen
 *
 * Request HealthKit and Throne permissions.
 * HealthKit is required, Throne is optional.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
  Platform,
  Alert,
  Linking,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, StanfordColors, Spacing } from '@/constants/theme';
import { OnboardingStep } from '@/lib/constants';
import { OnboardingService } from '@/lib/services/onboarding-service';
import { ThroneService } from '@/lib/services/throne-service';
import {
  requestHealthPermissions,
  areClinicalRecordsAvailable,
  requestClinicalPermissions,
} from '@/lib/services/healthkit';
import { requestNotificationPermissions } from '@/lib/services/notification-service';
import {
  OnboardingProgressBar,
  PermissionCard,
  ContinueButton,
  PermissionStatus,
} from '@/components/onboarding';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/lib/auth/auth-context';
import { saveThroneUserId } from '@/src/services/throneFirestore';

export default function PermissionsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();

  const [healthKitStatus, setHealthKitStatus] = useState<PermissionStatus>('not_determined');
  const [throneStatus, setThroneStatus] = useState<PermissionStatus>('not_determined');
  const [clinicalStatus, setClinicalStatus] = useState<PermissionStatus>('not_determined');
  const [clinicalAvailable, setClinicalAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Throne User ID modal state
  const [throneModalVisible, setThroneModalVisible] = useState(false);
  const [throneIdInput, setThroneIdInput] = useState('');
  const [throneIdSaving, setThroneIdSaving] = useState(false);

  // HealthKit is required, Throne is optional
  const canContinue = healthKitStatus === 'granted' || Platform.OS !== 'ios';

  useEffect(() => {
    let cancelled = false;
    async function checkStatus() {
      const thronePermission = await ThroneService.getPermissionStatus();
      if (!cancelled) setThroneStatus(thronePermission);

      if (Platform.OS === 'ios') {
        const available = areClinicalRecordsAvailable();
        if (!cancelled) setClinicalAvailable(available);
      }
    }
    checkStatus();
    return () => { cancelled = true; };
  }, []);

  const handleHealthKitRequest = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'HealthKit Not Available',
        'HealthKit is only available on iOS devices. For demo purposes, you can continue.',
        [{ text: 'OK' }]
      );
      setHealthKitStatus('granted');
      return;
    }

    setHealthKitStatus('loading');

    try {
      const result = await requestHealthPermissions();
      setHealthKitStatus(result.success ? 'granted' : 'denied');

      if (!result.success) {
        Alert.alert(
          'Permission Required',
          'HealthKit access is required for the study. Please enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch {
      setHealthKitStatus('denied');
      Alert.alert('Error', 'Failed to request HealthKit permissions. Please try again.');
    }
  }, []);

  const handleClinicalRequest = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      setClinicalStatus('granted');
      return;
    }

    setClinicalStatus('loading');
    try {
      const result = await requestClinicalPermissions();
      setClinicalStatus(result.success ? 'granted' : 'denied');
    } catch {
      setClinicalStatus('denied');
      Alert.alert('Error', 'Failed to request clinical records permissions.');
    }
  }, []);

  const handleClinicalSkip = useCallback(() => {
    setClinicalStatus('skipped');
  }, []);

  // Opens the Throne User ID modal instead of immediately calling the service
  const handleThroneRequest = useCallback(() => {
    setThroneIdInput('');
    setThroneModalVisible(true);
  }, []);

  // Called when the user confirms their Throne User ID in the modal
  const handleThroneIdConfirm = useCallback(async () => {
    const trimmed = throneIdInput.trim();
    if (!trimmed) return;

    setThroneIdSaving(true);
    try {
      const uid = user?.id;
      if (uid) {
        // SHORT-TERM: User manually enters their Throne User ID (found in the
        // Throne app under Profile → Account). We persist it here so the
        // syncThroneUserMap Cloud Function trigger automatically creates the
        // throneUserMap reverse-lookup entry for data ingestion.
        await saveThroneUserId(uid, trimmed);
      }

      // LONG-TERM (uncomment when real Throne SDK is available):
      // The OAuth flow will return the throneUserId automatically — no manual
      // entry needed. Replace the saveThroneUserId call above with:
      //
      // const throneResult = await ThroneSDK.authorize({ studyId: THRONE_STUDY_ID });
      // if (uid) await saveThroneUserId(uid, throneResult.userId);

      await ThroneService.requestPermission();
      setThroneStatus('granted');
      setThroneModalVisible(false);
    } catch {
      Alert.alert('Error', 'Failed to save Throne User ID. Please try again.');
    } finally {
      setThroneIdSaving(false);
    }
  }, [throneIdInput, user?.id]);

  const handleThroneSkip = useCallback(async () => {
    await ThroneService.skipSetup();
    setThroneStatus('skipped');
  }, []);

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      // Request notification permissions alongside health permissions
      await requestNotificationPermissions();

      await OnboardingService.updateData({
        permissions: {
          healthKit: healthKitStatus as 'granted' | 'denied' | 'not_determined',
          clinicalRecords: clinicalStatus as 'granted' | 'denied' | 'not_determined' | 'skipped',
          throne: throneStatus as 'granted' | 'denied' | 'not_determined' | 'skipped',
        },
      });
      await OnboardingService.goToStep(OnboardingStep.MEDICAL_HISTORY);
      router.push('/(onboarding)/medical-history' as Href);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <OnboardingProgressBar currentStep={OnboardingStep.PERMISSIONS} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.titleContainer}>
          <IconSymbol name={'lock.shield.fill' as any} size={32} color={StanfordColors.cardinal} />
          <Text style={[styles.title, { color: colors.text }]}>
            App Permissions
          </Text>
        </View>

        <Text style={[styles.description, { color: colors.icon }]}>
          StreamSync needs access to your health data to track your activity, sleep, and symptoms.
          Your data is encrypted and only used for research purposes.
        </Text>

        <PermissionCard
          title="Apple Health"
          description="Access step count, heart rate, sleep data, and activity levels from your iPhone and Apple Watch."
          icon="heart.fill"
          status={healthKitStatus}
          onRequest={handleHealthKitRequest}
        />

        <PermissionCard
          title="Clinical Records"
          description="Import medications, lab results, and conditions from your health records — reducing manual data entry."
          icon="doc.text.fill"
          status={clinicalStatus}
          onRequest={handleClinicalRequest}
          onSkip={handleClinicalSkip}
          optional
          comingSoon={!clinicalAvailable}
        />

        <PermissionCard
          title="Throne Uroflow"
          description="Connect your Throne device to track voiding patterns and flow measurements. You'll need your Throne User ID from the Throne app."
          icon="drop.fill"
          status={throneStatus}
          onRequest={handleThroneRequest}
          onSkip={handleThroneSkip}
          optional
        />

        <View
          style={[
            styles.infoBox,
            { backgroundColor: colorScheme === 'dark' ? '#1C1C1E' : '#F2F2F7' },
          ]}
        >
          <IconSymbol name="lock.shield.fill" size={20} color={colors.icon} />
          <Text style={[styles.infoText, { color: colors.icon }]}>
            You can change these permissions at any time in your device Settings.
            Your data is never sold or shared with third parties.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {!canContinue && (
          <Text style={[styles.footerHint, { color: colors.icon }]}>
            Apple Health access is required to continue
          </Text>
        )}
        <ContinueButton
          title="Continue"
          onPress={handleContinue}
          disabled={!canContinue}
          loading={isLoading}
        />
      </View>

      {/* Throne User ID Modal */}
      <Modal
        visible={throneModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setThroneModalVisible(false)}
      >
        <Pressable
          style={modalStyles.backdrop}
          onPress={() => setThroneModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <Pressable style={[modalStyles.sheet, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
              <View style={[modalStyles.handle, { backgroundColor: isDark ? '#3A3A3C' : '#E5E5EA' }]} />

              <View style={modalStyles.iconRow}>
                <IconSymbol name="drop.fill" size={28} color={StanfordColors.cardinal} />
              </View>

              <Text style={[modalStyles.title, { color: colors.text }]}>
                Connect Throne Device
              </Text>
              <Text style={[modalStyles.body, { color: colors.icon }]}>
                Enter your Throne User ID. You can find this in the Throne app under{' '}
                <Text style={{ fontWeight: '600' }}>Profile → Account → User ID</Text>.
              </Text>

              <TextInput
                style={[
                  modalStyles.input,
                  {
                    color: colors.text,
                    borderColor: isDark ? '#3A3A3C' : '#E5E5EA',
                    backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                  },
                ]}
                placeholder="e.g. usr_abc123xyz"
                placeholderTextColor={colors.icon}
                value={throneIdInput}
                onChangeText={setThroneIdInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleThroneIdConfirm}
              />

              <TouchableOpacity
                style={[
                  modalStyles.confirmButton,
                  { backgroundColor: throneIdInput.trim() ? StanfordColors.cardinal : (isDark ? '#3A3A3C' : '#E5E5EA') },
                ]}
                onPress={handleThroneIdConfirm}
                disabled={!throneIdInput.trim() || throneIdSaving}
                activeOpacity={0.8}
              >
                {throneIdSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[modalStyles.confirmText, { color: throneIdInput.trim() ? '#FFFFFF' : colors.icon }]}>
                    Connect
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={modalStyles.cancelButton}
                onPress={() => setThroneModalVisible(false)}
                disabled={throneIdSaving}
              >
                <Text style={[modalStyles.cancelText, { color: colors.icon }]}>Cancel</Text>
              </TouchableOpacity>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Spacing.sm },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.screenHorizontal },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  title: { fontSize: 28, fontWeight: '700' },
  description: {
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: Spacing.md,
    gap: 12,
    marginTop: Spacing.sm,
  },
  infoText: { fontSize: 14, lineHeight: 20, flex: 1 },
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
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 20,
  },
  iconRow: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(140,21,21,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 16,
  },
  confirmButton: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 15,
  },
});
