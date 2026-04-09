/**
 * Consent Viewer (Read-Only)
 *
 * Displays the full consent document without signature/agreement controls.
 * Opened from the Profile screen's "Study Consent" action.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CONSENT_DOCUMENT } from '@/lib/consent/consent-document';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppTheme } from '@/lib/theme/ThemeContext';
import { FontSize, FontWeight, LineHeight } from '@/lib/theme/typography';
import { StanfordColors } from '@/constants/theme';
import {
  openSavedConsentPdf,
  shareSavedConsentPdf,
} from '@/src/services/consentPdfSync';

export default function ConsentViewerScreen() {
  const { theme } = useAppTheme();
  const { colors: c } = theme;
  const router = useRouter();

  const handleOpenSavedCopy = async () => {
    try {
      const opened = await openSavedConsentPdf();
      if (!opened) {
        Alert.alert(
          'Signed Copy Not Available',
          'No saved signed consent form was found for this account yet.',
        );
      }
    } catch {
      Alert.alert(
        'Unable to Open Copy',
        'The saved signed consent form could not be opened right now.',
      );
    }
  };

  const handleShareSavedCopy = async () => {
    try {
      const shared = await shareSavedConsentPdf();
      if (!shared) {
        Alert.alert(
          'Signed Copy Not Available',
          'No saved signed consent form was found for this account yet.',
        );
      }
    } catch {
      Alert.alert(
        'Unable to Share Copy',
        'The saved signed consent form could not be shared right now.',
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.separator }]}>
        <View style={styles.headerLeft}>
          <IconSymbol name="doc.text.fill" size={18} color={StanfordColors.cardinal} />
          <Text style={[styles.headerTitle, { color: c.textPrimary }]}>
            Informed Consent
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={[styles.closeButton, { backgroundColor: c.secondaryFill }]}
        >
          <IconSymbol name="xmark" size={13} color={c.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.actionsCard, { backgroundColor: c.card }]}>
          <Text style={[styles.actionsTitle, { color: c.textPrimary }]}>
            Signed Consent Copy
          </Text>
          <Text style={[styles.actionsSubtitle, { color: c.textSecondary }]}>
            Download or share the signed and dated consent form saved for this account.
          </Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: c.secondaryFill }]}
              onPress={handleOpenSavedCopy}
              activeOpacity={0.7}
            >
              <IconSymbol name="arrow.down.doc.fill" size={16} color={StanfordColors.cardinal} />
              <Text style={[styles.actionButtonText, { color: c.textPrimary }]}>
                Download
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: c.secondaryFill }]}
              onPress={handleShareSavedCopy}
              activeOpacity={0.7}
            >
              <IconSymbol name="square.and.arrow.up.fill" size={16} color={StanfordColors.cardinal} />
              <Text style={[styles.actionButtonText, { color: c.textPrimary }]}>
                Share
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Study metadata card */}
        <View style={[styles.metaCard, { backgroundColor: c.card }]}>
          <View style={styles.metaHeader}>
            <View style={[styles.metaDot, { backgroundColor: StanfordColors.cardinal }]} />
            <Text style={[styles.metaLabel, { color: c.textTertiary }]}>STUDY DETAILS</Text>
          </View>
          <Text style={[styles.metaStudyName, { color: c.textPrimary }]}>
            {CONSENT_DOCUMENT.studyName}
          </Text>
          <View style={[styles.metaDivider, { backgroundColor: c.separator }]} />
          <MetaRow label="Institution" value={CONSENT_DOCUMENT.institution} c={c} />
          <MetaRow label="Principal Investigator" value={CONSENT_DOCUMENT.principalInvestigator} c={c} />
          <MetaRow label="IRB Protocol" value={CONSENT_DOCUMENT.irbProtocol} c={c} />
          <MetaRow label="Consent Version" value={CONSENT_DOCUMENT.version} c={c} isLast />
        </View>

        {/* Section cards */}
        {CONSENT_DOCUMENT.sections.map((section) => (
          <View key={section.id} style={[styles.sectionCard, { backgroundColor: c.card }]}>
            <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>
              {section.title}
            </Text>
            <Text style={[styles.sectionContent, { color: c.textSecondary }]}>
              {section.content.replace(/\*\*(.*?)\*\*/g, '$1')}
            </Text>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaRow({
  label,
  value,
  c,
  isLast = false,
}: {
  label: string;
  value: string;
  c: ReturnType<typeof useAppTheme>['theme']['colors'];
  isLast?: boolean;
}) {
  return (
    <View style={[styles.metaRow, !isLast && { borderBottomColor: c.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[styles.metaRowLabel, { color: c.textTertiary }]}>{label}</Text>
      <Text style={[styles.metaRowValue, { color: c.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: FontSize.headline,
    fontWeight: FontWeight.semibold,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },

  // Metadata card
  metaCard: {
    borderRadius: 12,
    padding: 16,
    overflow: 'hidden',
  },
  actionsCard: {
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  actionsTitle: {
    fontSize: FontSize.subhead,
    fontWeight: FontWeight.semibold,
  },
  actionsSubtitle: {
    fontSize: FontSize.footnote,
    lineHeight: LineHeight.footnote,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonText: {
    fontSize: FontSize.footnote,
    fontWeight: FontWeight.medium,
  },
  metaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  metaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metaLabel: {
    fontSize: FontSize.micro,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.6,
  },
  metaStudyName: {
    fontSize: FontSize.subhead,
    fontWeight: FontWeight.semibold,
    marginBottom: 12,
  },
  metaDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 12,
  },
  metaRowLabel: {
    fontSize: FontSize.footnote,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  metaRowValue: {
    fontSize: FontSize.footnote,
    fontWeight: FontWeight.regular,
    flex: 2,
    textAlign: 'right',
  },

  // Section cards
  sectionCard: {
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: FontSize.subhead,
    fontWeight: FontWeight.semibold,
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: FontSize.footnote,
    lineHeight: LineHeight.footnote,
  },
});
