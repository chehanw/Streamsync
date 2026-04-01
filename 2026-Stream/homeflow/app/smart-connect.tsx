/**
 * Smart Connect Modal
 *
 * Accessible from onboarding and profile to initiate a SMART on FHIR connection.
 * This screen lists available health systems, performs the generic SMART OAuth
 * flow, then immediately syncs clinical data into the generic provider-backed
 * Firestore collections used elsewhere in the app.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  connectSmartHealthSystem,
  getAvailableSmartHealthSystems,
  syncSmartClinicalData,
} from '@/lib/services/smart';
import type { SmartHealthSystem } from '@/lib/services/smart/types';
import { OnboardingService } from '@/lib/services/onboarding-service';
import { getAuth } from '@/src/services/firestore';

export default function SmartConnectModal() {
  const router = useRouter();
  const { systemId } = useLocalSearchParams<{ systemId?: string }>();
  const healthSystems = useMemo(() => {
    const systems = getAvailableSmartHealthSystems();
    if (!systemId) return systems;
    return systems.filter((system) => system.id === systemId);
  }, [systemId]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [launchingAuth, setLaunchingAuth] = useState(false);

  function buildImportSummary(syncResult: Awaited<ReturnType<typeof syncSmartClinicalData>>): string {
    if (syncResult.syncWarning) {
      return syncResult.syncWarning;
    }

    const medications = syncResult.clinicalRecords.medications.length;
    const labResults = syncResult.clinicalRecords.labResults.length;
    const conditions = syncResult.clinicalRecords.conditions.length;
    const procedures = syncResult.clinicalRecords.procedures.length;
    const notes = syncResult.clinicalRecords.notes?.length ?? 0;

    const parts = [
      medications ? `${medications} medication${medications === 1 ? '' : 's'}` : null,
      labResults ? `${labResults} lab result${labResults === 1 ? '' : 's'}` : null,
      conditions ? `${conditions} condition${conditions === 1 ? '' : 's'}` : null,
      procedures ? `${procedures} procedure${procedures === 1 ? '' : 's'}` : null,
      notes ? `${notes} clinical note${notes === 1 ? '' : 's'}` : null,
    ].filter(Boolean);

    if (parts.length === 0) {
      return 'Connected successfully, but no records were available from this account yet.';
    }

    return `Imported ${parts.join(', ')}.`;
  }

  async function handleConnect(system: SmartHealthSystem) {
    setLoading(true);
    setLoadingId(system.id);
    setLaunchingAuth(true);
    try {
      // Wait for Firebase Auth to finish restoring its persisted session before
      // checking currentUser.  Without this, currentUser can still be null on
      // the brief async window between app launch / screen mount and the first
      // onAuthStateChanged callback — causing a spurious "not signed in" error
      // even when the user just completed account creation in the previous step.
      const auth = getAuth();
      await auth.authStateReady();
      const uid = auth.currentUser?.uid;
      if (!uid) {
        throw new Error('You must be signed in before connecting a health system.');
      }

      if (system.openAccess) {
        throw new Error('Open-access FHIR servers are not supported in this build.');
      }

      await new Promise((resolve) => setTimeout(resolve, 150));
      const connection = await connectSmartHealthSystem(system);
      let syncResult: Awaited<ReturnType<typeof syncSmartClinicalData>> | null = null;

      try {
        syncResult = await syncSmartClinicalData(connection.providerId);
      } catch (error) {
        console.warn('[SMART] Initial clinical sync failed after connection:', error);
      }

      const onboardingData = await OnboardingService.getData();
      await OnboardingService.updateData({
        permissions: {
          healthKit: onboardingData.permissions?.healthKit ?? 'not_determined',
          clinicalRecords: onboardingData.permissions?.clinicalRecords ?? 'not_determined',
          throne: onboardingData.permissions?.throne ?? 'not_determined',
          smartProvider: 'granted',
        },
        providerConnection: {
          providerId: syncResult?.connection.providerId ?? connection.providerId,
          providerName: syncResult?.connection.providerName ?? connection.providerName,
          issuer: syncResult?.connection.issuer ?? connection.issuer,
          fhirBaseUrl: syncResult?.connection.fhirBaseUrl ?? connection.fhirBaseUrl,
          connectedAt: syncResult?.connection.connectedAt ?? connection.connectedAt ?? new Date().toISOString(),
        },
      });

      if (syncResult) {
        Alert.alert(
          'Health System Connected',
          buildImportSummary(syncResult),
        );
      } else {
        Alert.alert(
          'Health System Connected',
          'Connected successfully. Initial record sync did not complete, but you can try again from Profile.',
        );
      }
      router.back();
    } catch (error) {
      Alert.alert(
        'Connection Failed',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setLoading(false);
      setLoadingId(null);
      setLaunchingAuth(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Connect Health Records',
          headerLargeTitle: false,
          animation: 'fade',
        }}
      />
      <SafeAreaView style={styles.container}>
        <Text style={styles.subtitle}>
          Select your health provider to import clinical records.
        </Text>

        {healthSystems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No supported systems available</Text>
            <Text style={styles.emptyStateText}>
              Add a supported SMART provider configuration with a client ID to enable this flow.
            </Text>
          </View>
        ) : null}

        {healthSystems.map((system) => (
          <TouchableOpacity
            key={system.id}
            style={styles.systemRow}
            activeOpacity={0.7}
            disabled={loading}
            onPress={() => handleConnect(system)}
          >
            <Text style={styles.systemName}>{system.name}</Text>
            {loadingId === system.id ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text style={styles.arrow}>›</Text>
            )}
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        {launchingAuth ? (
          <View style={styles.launchOverlay}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.launchTitle}>Opening provider sign-in</Text>
            <Text style={styles.launchBody}>
              The secure patient portal may slide in next. Please wait while StreamSync opens it.
            </Text>
          </View>
        ) : null}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 20,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 24,
    lineHeight: 22,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  systemRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  systemName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  arrow: {
    fontSize: 22,
    color: '#C7C7CC',
  },
  cancelButton: {
    marginTop: 16,
    padding: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 17,
    color: '#007AFF',
  },
  launchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(242, 242, 247, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  launchTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  launchBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    textAlign: 'center',
  },
});
