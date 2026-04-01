import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Linking,
  Alert,
} from 'react-native';
import { useRouter, Href, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/hooks/use-auth';
import {
  DATA_PERMISSIONS_SUMMARY,
  STUDY_COORDINATOR,
} from '@/lib/consent/consent-document';
import { getConnectedSmartProviderStatus } from '@/lib/services/smart';
import { useAppTheme, type AppearanceMode } from '@/lib/theme/ThemeContext';
import { FontSize, FontWeight } from '@/lib/theme/typography';
import { getAuth } from '@/src/services/firestore';

const APPEARANCE_OPTIONS: { value: AppearanceMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function ProfileScreen() {
  const { theme, appearance, setAppearance } = useAppTheme();
  const { colors: c } = theme;
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [providerConnected, setProviderConnected] = useState(false);
  const [providerName, setProviderName] = useState<string | null>(null);
  const [providerTotalRecordCount, setProviderTotalRecordCount] = useState<number | null>(null);
  const [providerLastSynced, setProviderLastSynced] = useState<Date | null>(null);

  // Refresh SMART connection status each time the profile tab comes into focus
  // (e.g. user just connected from the smart-connect modal).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      async function checkProviderConnection() {
        const uid = getAuth().currentUser?.uid;
        if (!uid) return;
        try {
          const connection = await getConnectedSmartProviderStatus(uid);
          if (cancelled) return;
          if (connection) {
            setProviderConnected(true);
            setProviderName(connection.providerName);
            setProviderTotalRecordCount(connection.totalRecordCount);
            setProviderLastSynced(connection.lastSyncedAt ? new Date(connection.lastSyncedAt) : null);
          } else {
            setProviderConnected(false);
            setProviderName(null);
            setProviderTotalRecordCount(null);
            setProviderLastSynced(null);
          }
        } catch {
          // Silently ignore — user just sees "Not connected"
        }
      }
      checkProviderConnection();
      return () => { cancelled = true; };
    }, []),
  );

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/(auth)/login' as Href);
          } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to sign out.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.screenTitle, { color: c.textPrimary }]}>
          Profile
        </Text>

        {/* 1. Account */}
        <View style={[styles.card, { backgroundColor: c.card }]}>
          <View style={styles.cardHeader}>
            <IconSymbol name="person.circle.fill" size={17} color={c.textTertiary} />
            <Text style={[styles.cardLabel, { color: c.textTertiary }]}>Account</Text>
          </View>
          {user ? (
            <>
              <Text style={[styles.accountName, { color: c.textPrimary }]}>
                {user.firstName} {user.lastName}
              </Text>
              <Text style={[styles.accountEmail, { color: c.textSecondary }]}>
                {user.email}
              </Text>
            </>
          ) : (
            <Text style={[styles.placeholderText, { color: c.textTertiary }]}>
              Not signed in.
            </Text>
          )}
        </View>

        {/* 2. Appearance — iOS-style segmented control */}
        <View style={[styles.card, { backgroundColor: c.card }]}>
          <View style={styles.cardHeader}>
            <IconSymbol name="circle.lefthalf.filled" size={17} color={c.textSecondary} />
            <Text style={[styles.cardLabel, { color: c.textSecondary }]}>Appearance</Text>
          </View>
          <View style={[styles.segmentedControl, { backgroundColor: c.secondaryFill }]}>
            {APPEARANCE_OPTIONS.map((opt) => {
              const isSelected = appearance === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.segment,
                    isSelected && [styles.segmentSelected, { backgroundColor: c.card }],
                  ]}
                  onPress={() => setAppearance(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: c.textSecondary },
                      isSelected && { color: c.textPrimary, fontWeight: FontWeight.semibold },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 3. Study Consent & Data Permissions — iOS Settings-style rows */}
        <View style={[styles.card, { backgroundColor: c.card }]}>
          <TouchableOpacity
            style={styles.rowButton}
            onPress={() => router.push('/consent-viewer' as Href)}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <IconSymbol name="doc.text.fill" size={18} color={c.accent} />
              <Text style={[styles.rowLabel, { color: c.textPrimary }]}>
                Study Consent
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={14} color={c.textTertiary} />
          </TouchableOpacity>

          <View style={[styles.rowDivider, { backgroundColor: c.separator }]} />

          <TouchableOpacity
            style={styles.rowButton}
            onPress={() => setShowPermissionsModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <IconSymbol name="lock.shield" size={18} color={c.semanticSuccess} />
              <Text style={[styles.rowLabel, { color: c.textPrimary }]}>
                Data Permissions
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={14} color={c.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* 3b. Health Records */}
        <View style={[styles.card, { backgroundColor: c.card }]}>
          <TouchableOpacity
            style={styles.rowButton}
            onPress={() => router.push('/smart-connect' as Href)}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <IconSymbol name="doc.text.fill" size={18} color={c.accent} />
              <View>
                <Text style={[styles.rowLabel, { color: c.textPrimary }]}>
                  Health Records
                </Text>
                <Text style={[styles.rowSublabel, { color: c.textTertiary }]}>
                  {providerConnected
                    ? `Connected${providerName ? ` · ${providerName}` : ''}`
                    : 'Not connected — tap to set up'}
                </Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={14} color={c.textTertiary} />
          </TouchableOpacity>

          {providerConnected && (
            <>
              <View style={[styles.rowDivider, { backgroundColor: c.separator }]} />
              <TouchableOpacity
                style={styles.rowButton}
                onPress={() => router.push('/smart-connect' as Href)}
                activeOpacity={0.7}
              >
                <View style={styles.rowLeft}>
                  <IconSymbol name="doc.text.fill" size={18} color={c.textSecondary} />
                  <View>
                    <Text style={[styles.rowLabel, { color: c.textSecondary }]}>
                      Sync Records
                    </Text>
                    <Text style={[styles.rowSublabel, { color: c.textTertiary }]}>
                      {providerLastSynced
                        ? `Last synced ${providerLastSynced.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}${providerTotalRecordCount !== null ? ` · ${providerTotalRecordCount} record${providerTotalRecordCount === 1 ? '' : 's'}` : ''}`
                        : providerTotalRecordCount !== null ? `${providerTotalRecordCount} record${providerTotalRecordCount === 1 ? '' : 's'} imported` : 'Re-authenticate to pull fresh records'}
                    </Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={14} color={c.textTertiary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* 4. Contact / Support */}
        <View style={[styles.card, { backgroundColor: c.card }]}>
          <View style={styles.cardHeader}>
            <IconSymbol name="phone.fill" size={17} color={c.textSecondary} />
            <Text style={[styles.cardLabel, { color: c.textSecondary }]}>
              Contact for study questions
            </Text>
          </View>
          <Text style={[styles.contactName, { color: c.textPrimary }]}>
            {STUDY_COORDINATOR.name}
          </Text>
          <Text style={[styles.contactRole, { color: c.textTertiary }]}>
            {STUDY_COORDINATOR.role}
          </Text>

          <View style={styles.contactActions}>
            <TouchableOpacity
              style={[styles.contactButton, { backgroundColor: c.background }]}
              onPress={() => Linking.openURL(`mailto:${STUDY_COORDINATOR.email}`)}
              activeOpacity={0.7}
            >
              <IconSymbol name="envelope.fill" size={15} color={c.accent} />
              <Text style={[styles.contactButtonText, { color: c.textSecondary }]}>
                {STUDY_COORDINATOR.email}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.contactButton, { backgroundColor: c.background }]}
              onPress={() => Linking.openURL(`tel:${STUDY_COORDINATOR.phone}`)}
              activeOpacity={0.7}
            >
              <IconSymbol name="phone.fill" size={15} color={c.accent} />
              <Text style={[styles.contactButtonText, { color: c.textSecondary }]}>
                {STUDY_COORDINATOR.phone}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={[styles.signOutButton, { backgroundColor: c.card }]}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <IconSymbol name="rectangle.portrait.and.arrow.right" size={18} color="#D64545" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Data Permissions modal */}
      <Modal
        visible={showPermissionsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPermissionsModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowPermissionsModal(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: c.card }]}
            onPress={() => {}}
          >
            <View style={styles.modalHandle} />
            <IconSymbol
              name="lock.shield.fill"
              size={32}
              color={c.semanticSuccess}
              style={{ alignSelf: 'center', marginBottom: 16 }}
            />
            <Text style={[styles.modalTitle, { color: c.textPrimary }]}>
              Data Permissions
            </Text>
            <Text style={[styles.modalSubhead, { color: c.textTertiary }]}>
              What this app can access:
            </Text>
            {DATA_PERMISSIONS_SUMMARY.map((item, index) => (
              <View key={index} style={styles.bulletRow}>
                <View style={[styles.bullet, { backgroundColor: c.textTertiary }]} />
                <Text style={[styles.bulletText, { color: c.textSecondary }]}>
                  {item}
                </Text>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: c.accent }]}
              onPress={() => setShowPermissionsModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalButtonText}>
                Got It
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  screenTitle: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.37,
    marginBottom: 20,
  },

  // Cards — iOS grouped style
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: FontSize.footnote,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.2,
  },

  // Account info
  accountName: {
    fontSize: FontSize.headline,
    fontWeight: FontWeight.semibold,
    color: '#2C3E50',
  },
  accountNameDark: {
    color: '#D4D8E8',
  },
  accountEmail: {
    fontSize: FontSize.footnote,
    color: '#7A7F8E',
    marginTop: 2,
  },
  accountEmailDark: {
    color: '#6B7394',
  },
  placeholderText: {
    fontSize: FontSize.subhead,
    lineHeight: 22,
    fontStyle: 'italic',
  },

  // Segmented control — iOS style
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 9,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 7,
  },
  segmentSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: FontSize.footnote,
    fontWeight: FontWeight.medium,
  },

  // Sign out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  signOutText: {
    fontSize: FontSize.subhead,
    fontWeight: FontWeight.semibold,
    color: '#D64545',
  },

  // Tappable row buttons — iOS Settings style
  rowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowLabel: {
    fontSize: FontSize.headline,
    fontWeight: FontWeight.regular,
  },
  rowSublabel: {
    fontSize: FontSize.footnote,
    marginTop: 2,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 44,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingRight: 4,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 8,
    marginRight: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: FontSize.subhead,
    lineHeight: 22,
  },

  // Contact
  contactName: {
    fontSize: FontSize.headline,
    fontWeight: FontWeight.semibold,
  },
  contactRole: {
    fontSize: FontSize.footnote,
    marginTop: 2,
    marginBottom: 14,
  },
  contactActions: {
    gap: 8,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  contactButtonText: {
    fontSize: FontSize.subhead,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalContent: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    padding: 20,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#C7C7CC',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: FontSize.headline,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalBody: {
    fontSize: FontSize.subhead,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalSubhead: {
    fontSize: FontSize.footnote,
    fontWeight: FontWeight.medium,
    marginBottom: 12,
    textAlign: 'left',
  },
  modalButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonText: {
    fontSize: FontSize.headline,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
});
