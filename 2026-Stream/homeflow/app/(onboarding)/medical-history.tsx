/**
 * Medical History Screen
 *
 * Displays health records pulled from Apple Health and asks the patient
 * to confirm their information section by section.
 *
 * Flow:
 *   1. Loading: fetch clinical records + HealthKit demographics in parallel
 *      (falls back to mock data in dev mode if no records are connected)
 *   2. Reviewing: 3-step confirmation UI
 *      Step 0 — Demographics (age, sex)
 *      Step 1 — Current Medications (grouped by drug class)
 *      Step 2 — Surgical History (BPH procedures + other surgeries)
 *   3. Complete: show confirmation screen and navigate to baseline survey
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Animated,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter, Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, StanfordColors, Spacing } from '@/constants/theme';
import { OnboardingStep } from '@/lib/constants';
import { OnboardingService } from '@/lib/services/onboarding-service';
import { OnboardingProgressBar, ContinueButton } from '@/components/onboarding';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getAllClinicalRecords } from '@/lib/services/healthkit';
import { getDemographics } from '@/lib/services/healthkit/HealthKitClient';
import {
  buildMedicalHistoryPrefill,
  type MedicalHistoryPrefill,
  type LabValue,
} from '@/lib/services/fhir';
import { BPH_DRUGS } from '@/lib/services/fhir/codes';
import { getMockClinicalRecords, getMockDemographics } from '@/lib/services/healthkit/mock-health-data';
import { saveMedicalHistory } from '@/src/services/throneFirestore';
import { getAuth } from '@/src/services/firestore';
import { syncFhirPrefill } from '@/src/services/fhirPrefillSync';
import { ConsentService } from '@/lib/services/consent-service';

// ── Types ─────────────────────────────────────────────────────────────

type MedicalHistoryPhase = 'loading' | 'reviewing' | 'complete';

const STEP_TITLES = ['Demographics', 'Current Medications', 'Surgical History', 'Lab Results', 'Conditions', 'Clinical Measurements'] as const;

const STEP_DESCRIPTIONS = [
  'Your basic information from Apple Health.',
  'Medications found in your health records.',
  'Past procedures found in your health records.',
  'Recent lab results found in your health records.',
  'Medical conditions found in your health records.',
  'Bladder and urinary function measurements.',
] as const;

const SEX_OPTIONS = [
  'Male',
  'Female',
  'Intersex',
  'Prefer not to say',
] as const;

const ETHNICITY_OPTIONS = [
  'Hispanic or Latino',
  'Not Hispanic or Latino',
  'Prefer not to say',
] as const;

const RACE_OPTIONS = [
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Native Hawaiian or Other Pacific Islander',
  'White',
  'More than one race',
  'Prefer not to say',
] as const;

type DemoStage = 'name' | 'ethnicity' | 'race' | 'done';
type PickerField = 'ethnicity' | 'race' | 'biologicalSex';

// Common patient-facing names for surgical procedures, matched by keyword
const PROCEDURE_COMMON_NAMES: { keywords: string[]; commonName: string }[] = [
  // BPH / prostate
  { keywords: ['transurethral resection', 'turp'], commonName: 'Prostate Resection' },
  { keywords: ['holmium laser enucleation', 'holep'], commonName: 'Laser Prostate Surgery' },
  { keywords: ['greenlight', 'green light', 'photoselective vaporization', 'pvp'], commonName: 'Laser Prostate Vaporization' },
  { keywords: ['prostatic urethral lift', 'urolift'], commonName: 'Prostate Lift' },
  { keywords: ['water vapor', 'rezum'], commonName: 'Steam Prostate Treatment' },
  { keywords: ['aquablation'], commonName: 'Water Jet Prostate Treatment' },
  { keywords: ['prostatectomy', 'prostate removal'], commonName: 'Prostate Removal' },
  // General urology
  { keywords: ['cystoscopy'], commonName: 'Bladder Scope Exam' },
  { keywords: ['transurethral resection of bladder', 'turbt'], commonName: 'Bladder Tumor Removal' },
  { keywords: ['lithotripsy', 'nephrolithotomy', 'ureteroscopy', 'kidney stone'], commonName: 'Kidney Stone Surgery' },
  // Abdominal / GI
  { keywords: ['appendectomy', 'appendix'], commonName: 'Appendix Removal' },
  { keywords: ['cholecystectomy', 'gallbladder'], commonName: 'Gallbladder Removal' },
  { keywords: ['colectomy', 'colon resection'], commonName: 'Colon Surgery' },
  { keywords: ['hernia'], commonName: 'Hernia Repair' },
  { keywords: ['colonoscopy'], commonName: 'Colonoscopy' },
  { keywords: ['gastrectomy', 'stomach resection'], commonName: 'Stomach Surgery' },
  // Orthopedic
  { keywords: ['total hip', 'hip arthroplasty', 'hip replacement'], commonName: 'Hip Replacement' },
  { keywords: ['total knee', 'knee arthroplasty', 'knee replacement'], commonName: 'Knee Replacement' },
  { keywords: ['shoulder arthroplasty', 'shoulder replacement'], commonName: 'Shoulder Replacement' },
  { keywords: ['spinal fusion'], commonName: 'Spinal Fusion' },
  { keywords: ['laminectomy', 'discectomy', 'microdiscectomy'], commonName: 'Back Surgery' },
  { keywords: ['carpal tunnel'], commonName: 'Carpal Tunnel Release' },
  // Cardiac / vascular
  { keywords: ['coronary artery bypass', 'cabg', 'bypass graft'], commonName: 'Heart Bypass Surgery' },
  { keywords: ['cardiac catheterization', 'coronary angiography'], commonName: 'Heart Catheterization' },
  { keywords: ['pacemaker'], commonName: 'Pacemaker Implant' },
  { keywords: ['valve replacement', 'valvuloplasty'], commonName: 'Heart Valve Surgery' },
  // Eye / ENT
  { keywords: ['cataract'], commonName: 'Cataract Surgery' },
  { keywords: ['tonsillectomy', 'tonsil'], commonName: 'Tonsil Removal' },
  { keywords: ['adenoidectomy', 'adenoid'], commonName: 'Adenoid Removal' },
  { keywords: ['septoplasty', 'rhinoplasty'], commonName: 'Nasal Surgery' },
  // Thyroid / endocrine
  { keywords: ['thyroidectomy', 'thyroid'], commonName: 'Thyroid Removal' },
  { keywords: ['parathyroidectomy'], commonName: 'Parathyroid Removal' },
  // Reproductive
  { keywords: ['hysterectomy', 'uterus removal'], commonName: 'Uterus Removal' },
  { keywords: ['oophorectomy', 'ovary removal'], commonName: 'Ovary Removal' },
  { keywords: ['vasectomy'], commonName: 'Vasectomy' },
  { keywords: ['circumcision'], commonName: 'Circumcision' },
  // Breast / skin
  { keywords: ['mastectomy', 'breast removal'], commonName: 'Breast Removal' },
  { keywords: ['lumpectomy'], commonName: 'Breast Lump Removal' },
];

function getCommonProcedureName(name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const entry of PROCEDURE_COMMON_NAMES) {
    if (entry.keywords.some(kw => lower.includes(kw))) {
      return entry.commonName;
    }
  }
  return undefined;
}

type EditableMedItem = {
  id: string;
  name: string;        // scientific name + dosage (e.g., "tamsulosin 0.4 mg oral capsule")
  brandName?: string;  // capitalized brand name if found (e.g., "Flomax")
  groupKey: string;
};
type EditableProcItem = {
  id: string;
  name: string;        // scientific/FHIR name (e.g., "Transurethral Resection of the Prostate")
  commonName?: string; // patient-friendly label (e.g., "Prostate Resection")
  date?: string;
  isBPH: boolean;
};

type EditableCondItem = {
  id: string;
  name: string;
};

// ── Helpers ──────────────────────────────────────────────────────────

function formatShortDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Shared sub-components (module-level to prevent remount on re-render) ──────
//
// IMPORTANT: These must live outside MedicalHistoryScreen. Defining components
// inside the parent function gives them a new reference on every render, which
// causes React to unmount/remount them (losing TextInput focus on each keystroke).

type RowColors = { icon: string; text: string };

function DataRow({
  label,
  value,
  found,
  placeholder = 'will ask',
  showBadge = true,
  onPress,
  colors,
  borderColor,
}: {
  label: string;
  value: string | null | undefined;
  found: boolean;
  placeholder?: string;
  showBadge?: boolean;
  onPress?: () => void;
  colors: RowColors;
  borderColor: string;
}) {
  const inner = (
    <>
      <Text style={[reviewStyles.dataLabel, { color: colors.icon }]}>{label}</Text>
      <View style={reviewStyles.dataRight}>
        {found && value ? (
          <>
            <Text style={[reviewStyles.dataValue, { color: colors.text }]}>{value}</Text>
            {showBadge && (
              <View style={reviewStyles.sourceBadge}>
                <Text style={reviewStyles.sourceBadgeText}>Apple Health</Text>
              </View>
            )}
          </>
        ) : (
          <Text style={[reviewStyles.willAskText, { color: colors.icon }]}>
            {placeholder}
          </Text>
        )}
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[reviewStyles.dataRow, { borderBottomColor: borderColor }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[reviewStyles.dataRow, { borderBottomColor: borderColor }]}>
      {inner}
    </View>
  );
}

function InlineInputRow({
  label,
  value,
  onChange,
  onSubmit,
  keyboardType = 'default',
  autoFocus: af = true,
  placeholder = 'Type here…',
  autoCapitalize = 'words',
  colors,
  borderColor,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  keyboardType?: 'default' | 'numeric' | 'number-pad';
  autoFocus?: boolean;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  colors: RowColors;
  borderColor: string;
}) {
  return (
    <View style={[reviewStyles.dataRow, { borderBottomColor: borderColor }]}>
      <Text style={[reviewStyles.dataLabel, { color: colors.icon }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        returnKeyType="done"
        autoFocus={af}
        keyboardType={keyboardType}
        style={[reviewStyles.inlineInput, { color: colors.text }]}
        placeholderTextColor={colors.icon}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />
    </View>
  );
}

function SelectDataRow({
  label,
  onPress,
  colors,
  borderColor,
}: {
  label: string;
  onPress: () => void;
  colors: RowColors;
  borderColor: string;
}) {
  return (
    <TouchableOpacity
      style={[reviewStyles.dataRow, { borderBottomColor: borderColor }]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Text style={[reviewStyles.dataLabel, { color: colors.icon }]}>{label}</Text>
      <View style={reviewStyles.dataRight}>
        <Text style={[reviewStyles.selectHint, { color: StanfordColors.cardinal }]}>
          Tap to select
        </Text>
        <IconSymbol name="chevron.right" size={13} color={StanfordColors.cardinal} />
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────

export default function MedicalHistoryScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  const [phase, setPhase] = useState<MedicalHistoryPhase>('loading');
  const [reviewStep, setReviewStep] = useState(0);
  const [correctionsNeeded, setCorrectionsNeeded] = useState<Set<number>>(new Set());
  const [prefillData, setPrefillData] = useState<MedicalHistoryPrefill | null>(null);

  // Demographics sequential input state
  const [demoName, setDemoName] = useState('');
  const [demoAge, setDemoAge] = useState('');
  const [demoBiologicalSex, setDemoBiologicalSex] = useState('');
  const [demoEthnicity, setDemoEthnicity] = useState('');
  const [demoRace, setDemoRace] = useState('');
  const [demoStage, setDemoStage] = useState<DemoStage>('name');
  const [demoEditingField, setDemoEditingField] = useState<'name' | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerField, setPickerField] = useState<PickerField>('ethnicity');

  // Editable medication/procedure items (local copies initialized from prefill)
  const [editableMeds, setEditableMeds] = useState<EditableMedItem[]>([]);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [editingMedValue, setEditingMedValue] = useState('');
  const [otherMeds, setOtherMeds] = useState<EditableMedItem[]>([]);
  const [editableProcs, setEditableProcs] = useState<EditableProcItem[]>([]);
  const [editingProcId, setEditingProcId] = useState<string | null>(null);
  const [editingProcValue, setEditingProcValue] = useState('');

  const [otherConds, setOtherConds] = useState<EditableCondItem[]>([]);
  const [editingCondId, setEditingCondId] = useState<string | null>(null);
  const [editingCondValue, setEditingCondValue] = useState('');

  const stepFade = useRef(new Animated.Value(1)).current;
  const confirmFade = useRef(new Animated.Value(0)).current;
  // Tracks last-tap timestamps per field for double-tap detection
  const lastTapTimes = useRef<Record<string, number>>({});

  // ── Load clinical records ─────────────────────────────────────────

  const loadPrefillData = useCallback(async (forceMock = false) => {
    setPhase('loading');

    try {
      let clinicalRecords = null;
      let demographics = { age: null, dateOfBirth: null, biologicalSex: null };

      if (forceMock) {
        clinicalRecords = getMockClinicalRecords();
        demographics = getMockDemographics();
      } else {
        [clinicalRecords, demographics] = await Promise.all([
          getAllClinicalRecords().catch(() => null),
          getDemographics().catch(() => ({ age: null, dateOfBirth: null, biologicalSex: null })),
        ]);

        // In dev mode, use mock data when no real records are available
        if (__DEV__ && !clinicalRecords?.medications?.length && !clinicalRecords?.conditions?.length) {
          clinicalRecords = getMockClinicalRecords();
          demographics = getMockDemographics();
        }
      }

      const prefill = buildMedicalHistoryPrefill(clinicalRecords, demographics);

      setPrefillData(prefill);

      // Write prefill to Firestore now that we have live HealthKit data.
      // bootstrapHealthKitSync may have run before HealthKit clinical record
      // queries settled — this ensures the prefill is always persisted.
      syncFhirPrefill().catch((err) =>
        console.warn('[MedicalHistory] prefill sync error:', err),
      );

      // Build flat editable lists from the prefill (only BPH-relevant drug groups)
      const medGroupKeys = ['alphaBlockers', 'fiveARIs', 'anticholinergics', 'beta3Agonists', 'otherBPH'] as const;
      const medItems: EditableMedItem[] = [];
      for (const groupKey of medGroupKeys) {
        (prefill.medications[groupKey].value ?? []).forEach((m, i) => {
          const drugEntry = m.genericName
            ? BPH_DRUGS.find(d => d.generic === m.genericName!.toLowerCase())
            : undefined;
          const brandName = drugEntry?.brands[0] ? capitalize(drugEntry.brands[0]) : undefined;
          medItems.push({ id: `${groupKey}_${i}`, name: m.name, brandName, groupKey });
        });
      }
      setEditableMeds(medItems);
      setEditingMedId(null);
      setEditingMedValue('');

      const procItems: EditableProcItem[] = [];
      (prefill.surgicalHistory.bphProcedures.value ?? []).forEach((p, i) => {
        procItems.push({ id: `bph_${i}`, name: p.name, commonName: getCommonProcedureName(p.name), date: p.date, isBPH: true });
      });
      (prefill.surgicalHistory.otherProcedures.value ?? []).forEach((p, i) => {
        procItems.push({ id: `other_${i}`, name: p.name, commonName: getCommonProcedureName(p.name), date: p.date, isBPH: false });
      });
      setEditableProcs(procItems);
      setEditingProcId(null);
      setEditingProcValue('');

      setOtherConds([]);
      setEditingCondId(null);
      setEditingCondValue('');

      setReviewStep(0);
      setCorrectionsNeeded(new Set());
      setDemoAge('');
      setDemoBiologicalSex('');
      setDemoEthnicity('');
      setDemoRace('');
      setDemoEditingField(null);

      // Pre-fill name from consent signature — must happen after all resets
      // so it isn't overwritten. The consent record is in-memory so this is fast.
      const consentRecord = await ConsentService.getConsentRecord();
      const consentName = consentRecord?.participantSignature;
      if (consentName && consentName !== '[Drawn signature provided]') {
        setDemoName(consentName);
        setDemoStage('ethnicity');
      } else {
        setDemoName('');
        setDemoStage('name');
      }

      setPhase('reviewing');
    } catch {
      setPhase('reviewing');
    }
  }, []);

  useEffect(() => {
    loadPrefillData();
  }, [loadPrefillData]);

  // ── Review step navigation ────────────────────────────────────────

  const handleConfirmStep = useCallback((withCorrection = false) => {
    const updatedCorrections = withCorrection
      ? new Set([...correctionsNeeded, reviewStep])
      : correctionsNeeded;

    Animated.timing(stepFade, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      if (withCorrection) setCorrectionsNeeded(updatedCorrections);

      if (reviewStep < 5) {
        setReviewStep(prev => prev + 1);
      } else {
        // All sections reviewed — go directly to complete
        setPhase('complete');
        Animated.spring(confirmFade, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }).start();
      }

      Animated.timing(stepFade, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  }, [correctionsNeeded, reviewStep, stepFade, confirmFade]);

  // ── Picker handler ────────────────────────────────────────────────

  const handlePickerSelect = useCallback((value: string) => {
    setPickerVisible(false);
    if (pickerField === 'ethnicity') {
      setDemoEthnicity(value);
      setDemoStage('race');
    } else if (pickerField === 'race') {
      setDemoRace(value);
      setDemoStage('done');
    } else {
      setDemoBiologicalSex(value);
    }
  }, [pickerField]);

  const openPicker = useCallback((field: PickerField) => {
    setPickerField(field);
    setPickerVisible(true);
  }, []);

  // Double-tap detection: call action() if two taps arrive within 300 ms
  const handleFieldDoubleTap = useCallback((key: string, action: () => void) => {
    const now = Date.now();
    const last = lastTapTimes.current[key] ?? 0;
    if (now - last < 300) {
      lastTapTimes.current[key] = 0;
      action();
    } else {
      lastTapTimes.current[key] = now;
    }
  }, []);

  // ── Save and navigate ─────────────────────────────────────────────

  const handleContinue = async () => {
    const medications: string[] = [];
    const conditions: string[] = [];
    const surgicalHistory: string[] = [];
    const bphTreatmentHistory: string[] = [];

    // Use the user-edited lists (initialized from health records, may have been corrected)
    for (const med of editableMeds) {
      medications.push(med.name);
      bphTreatmentHistory.push(med.name);
    }

    for (const proc of editableProcs) {
      surgicalHistory.push(proc.name);
      if (proc.isBPH) bphTreatmentHistory.push(proc.name);
    }

    if (prefillData) {
      const condEntries = [
        prefillData.conditions.diabetes,
        prefillData.conditions.hypertension,
        prefillData.conditions.bph,
        prefillData.conditions.other,
      ];
      for (const entry of condEntries) {
        if (entry.value) {
          for (const cond of entry.value) conditions.push(cond.name);
        }
      }
    }

    for (const cond of otherConds) {
      if (cond.name.trim()) conditions.push(cond.name.trim());
    }

    const demoSummary = [
      demoName && `Name: ${demoName}`,
      demoAge && `Age: ${demoAge}`,
      demoBiologicalSex && `Sex: ${demoBiologicalSex}`,
      demoEthnicity && `Ethnicity: ${demoEthnicity}`,
      demoRace && `Race: ${demoRace}`,
    ].filter(Boolean).join(', ');

    await OnboardingService.updateData({
      medicalHistory: {
        medications,
        conditions,
        allergies: [],
        surgicalHistory,
        bphTreatmentHistory,
        rawTranscript: `reviewed from health records${demoSummary ? ` | ${demoSummary}` : ''}`,
      },
    });

    // ── Write combined medical_history/current to Firestore ──────────
    // User form data + FHIR prefill for fields not collected in the form
    // (labs, clinical measurements, HK demographics).
    const uid = getAuth().currentUser?.uid;
    if (uid) {
      const labEntry = (entry: { value: LabValue | null } | undefined) =>
        entry?.value ?? null;

      // HIPAA Safe Harbor de-identification helpers
      const deidentifyAge = (age: number | null): number | '90+' | null => {
        if (age === null) return null;
        return age >= 89 ? '90+' : age;
      };
      const yearOnly = (dateStr: string | null | undefined): string | undefined => {
        if (!dateStr) return undefined;
        const year = new Date(dateStr).getFullYear();
        return Number.isNaN(year) ? undefined : String(year);
      };
      const deidentifyLab = (entry: ReturnType<typeof labEntry>) => {
        if (!entry) return null;
        return { ...entry, date: yearOnly(entry.date) ?? entry.date };
      };

      const rawAge = prefillData?.demographics.age.value ?? (demoAge ? parseInt(demoAge, 10) : null);

      saveMedicalHistory(uid, {
        demographics: {
          // name omitted — HIPAA Safe Harbor identifier #1
          ethnicity: demoEthnicity,
          race: demoRace,
          age: deidentifyAge(rawAge),
          biologicalSex: prefillData?.demographics.biologicalSex.value ?? (demoBiologicalSex || null),
          dateOfBirth: null,
        },
        medications: editableMeds.map(m => ({
          name: m.name,
          brandName: m.brandName,
          groupKey: m.groupKey,
        })),
        surgicalHistory: editableProcs.map(p => ({
          name: p.name,
          commonName: p.commonName,
          date: yearOnly(p.date),  // year only — HIPAA identifier #3
          isBPH: p.isBPH,
        })),
        conditions: conditions.map(name => ({ name })),
        labs: {
          psa: deidentifyLab(labEntry(prefillData?.labs.psa)),
          hba1c: deidentifyLab(labEntry(prefillData?.labs.hba1c)),
          urinalysis: deidentifyLab(labEntry(prefillData?.labs.urinalysis)),
        },
        clinicalMeasurements: {
          pvr: deidentifyLab(labEntry(prefillData?.clinicalMeasurements.pvr)),
          uroflowQmax: deidentifyLab(labEntry(prefillData?.clinicalMeasurements.uroflowQmax)),
          volumeVoided: deidentifyLab(labEntry(prefillData?.clinicalMeasurements.volumeVoided)),
          mobility: prefillData?.clinicalMeasurements.mobility.value ?? null,
        },
      }).catch((err) => {
        console.warn('[MedicalHistory] Failed to save to Firestore:', err);
      });
    }

    await OnboardingService.goToStep(OnboardingStep.BASELINE_SURVEY);
    router.push('/(onboarding)/baseline-survey' as Href);
  };

  // ── Shared style values ───────────────────────────────────────────

  const cardBg = isDark ? '#1E2022' : '#F5F5F7';
  const sectionBg = isDark ? '#2A2D2F' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

  function ProcedureSection({ label, items }: { label: string; items: EditableProcItem[] }) {
    return (
      <View style={reviewStyles.medGroup}>
        <Text style={[reviewStyles.medGroupLabel, { color: colors.icon }]}>{label}</Text>
        {items.length > 0 ? (
          items.map(item => (
            <View key={item.id} style={reviewStyles.medItem}>
              <Text style={[reviewStyles.medBullet, { color: StanfordColors.cardinal }]}>•</Text>
              {editingProcId === item.id ? (
                <TextInput
                  value={editingProcValue}
                  onChangeText={setEditingProcValue}
                  onSubmitEditing={() => {
                    setEditableProcs(prev => prev.map(p =>
                      p.id === item.id ? { ...p, name: editingProcValue.trim() || p.name } : p
                    ));
                    setEditingProcId(null);
                  }}
                  returnKeyType="done"
                  autoFocus
                  style={[reviewStyles.medEditInput, { color: colors.text }]}
                />
              ) : (
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => handleFieldDoubleTap(`proc_${item.id}`, () => {
                    setEditingProcId(item.id);
                    setEditingProcValue(item.name);
                    setEditingMedId(null);
                  })}
                  activeOpacity={0.8}
                >
                  <View style={reviewStyles.procNameRow}>
                    {item.commonName ? (
                      <Text style={[reviewStyles.medName, { color: colors.text }]}>
                        {item.commonName}{' '}
                        <Text style={reviewStyles.medNameSecondary}>({item.name})</Text>
                      </Text>
                    ) : (
                      <Text style={[reviewStyles.medName, { color: colors.text }]}>{item.name}</Text>
                    )}
                    {item.date && (
                      <Text style={[reviewStyles.procDate, { color: colors.icon }]}>
                        {formatShortDate(item.date)}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              {editingProcId !== item.id && (
                <View style={reviewStyles.sourceBadge}>
                  <Text style={reviewStyles.sourceBadgeText}>Health Records</Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <Text style={[reviewStyles.noneFound, { color: colors.icon }]}>
            None found in health records
          </Text>
        )}
      </View>
    );
  }

  function renderStepContent() {
    if (!prefillData) return null;

    switch (reviewStep) {
      case 0:
        return (
          <View style={[reviewStyles.card, { backgroundColor: sectionBg }]}>
            {/* Age — static if from Apple Health, editable input otherwise */}
            {prefillData.demographics.age.confidence !== 'none' && prefillData.demographics.age.value != null ? (
              <DataRow
                label="Age"
                value={`${prefillData.demographics.age.value} years`}
                found
                colors={colors}
                borderColor={borderColor}
              />
            ) : (
              <InlineInputRow
                label="Age"
                value={demoAge}
                onChange={setDemoAge}
                onSubmit={() => {}}
                keyboardType="number-pad"
                autoFocus={false}
                placeholder="Enter age in years"
                autoCapitalize="none"
                colors={colors}
                borderColor={borderColor}
              />
            )}

            {/* Biological Sex — static if from Apple Health, picker otherwise */}
            {prefillData.demographics.biologicalSex.confidence !== 'none' && prefillData.demographics.biologicalSex.value ? (
              <DataRow
                label="Biological Sex"
                value={capitalize(prefillData.demographics.biologicalSex.value)}
                found
                colors={colors}
                borderColor={borderColor}
              />
            ) : demoBiologicalSex ? (
              <DataRow
                label="Biological Sex"
                value={demoBiologicalSex}
                found
                showBadge={false}
                onPress={() => handleFieldDoubleTap('biologicalSex', () => openPicker('biologicalSex'))}
                colors={colors}
                borderColor={borderColor}
              />
            ) : (
              <SelectDataRow
                label="Biological Sex"
                onPress={() => openPicker('biologicalSex')}
                colors={colors}
                borderColor={borderColor}
              />
            )}

            {/* Full Name — inline input on initial entry or when re-editing */}
            {(demoStage === 'name' || demoEditingField === 'name') ? (
              <InlineInputRow
                label="Full Name"
                value={demoName}
                onChange={setDemoName}
                onSubmit={() => {
                  if (demoStage === 'name') {
                    setDemoStage('ethnicity');
                  } else {
                    setDemoEditingField(null);
                  }
                }}
                colors={colors}
                borderColor={borderColor}
              />
            ) : (
              <DataRow
                label="Full Name"
                value={demoName || '—'}
                found
                showBadge={false}
                onPress={() => handleFieldDoubleTap('name', () => setDemoEditingField('name'))}
                colors={colors}
                borderColor={borderColor}
              />
            )}

            {/* Ethnicity — tap-to-select, then locks as static (double-tap to re-open) */}
            {(demoStage === 'ethnicity' || demoStage === 'race' || demoStage === 'done') && (
              demoEthnicity ? (
                <DataRow
                  label="Ethnicity"
                  value={demoEthnicity}
                  found
                  showBadge={false}
                  onPress={() => handleFieldDoubleTap('ethnicity', () => openPicker('ethnicity'))}
                  colors={colors}
                  borderColor={borderColor}
                />
              ) : (
                <SelectDataRow
                  label="Ethnicity"
                  onPress={() => openPicker('ethnicity')}
                  colors={colors}
                  borderColor={borderColor}
                />
              )
            )}

            {/* Race — tap-to-select, then locks as static (double-tap to re-open) */}
            {(demoStage === 'race' || demoStage === 'done') && (
              demoRace ? (
                <DataRow
                  label="Race"
                  value={demoRace}
                  found
                  showBadge={false}
                  onPress={() => handleFieldDoubleTap('race', () => openPicker('race'))}
                  colors={colors}
                  borderColor={borderColor}
                />
              ) : (
                <SelectDataRow
                  label="Race"
                  onPress={() => openPicker('race')}
                  colors={colors}
                  borderColor={borderColor}
                />
              )
            )}
          </View>
        );

      case 1: {
        return (
          <>
            {/* All health-record medications in a single flat list */}
            <View style={[reviewStyles.card, { backgroundColor: sectionBg }]}>
              <View style={reviewStyles.cardSectionTitleRow}>
                <Text style={[reviewStyles.cardSectionTitle, reviewStyles.cardSectionTitleInRow, { color: colors.icon }]}>
                  MEDICATIONS FROM HEALTH RECORDS
                </Text>
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => {
                    if (editableMeds.length > 0) {
                      setEditingMedId(editableMeds[0].id);
                      setEditingMedValue(editableMeds[0].name);
                      setEditingProcId(null);
                    }
                  }}
                >
                  <IconSymbol name="pencil" size={15} color={colors.icon} />
                </TouchableOpacity>
              </View>
              <View style={reviewStyles.medGroup}>
                {editableMeds.length > 0 ? (
                  editableMeds.map(item => (
                    <View key={item.id} style={reviewStyles.medItem}>
                      <Text style={[reviewStyles.medBullet, { color: StanfordColors.cardinal }]}>•</Text>
                      {editingMedId === item.id ? (
                        <TextInput
                          value={editingMedValue}
                          onChangeText={setEditingMedValue}
                          onSubmitEditing={() => {
                            setEditableMeds(prev => prev.map(m =>
                              m.id === item.id ? { ...m, name: editingMedValue.trim() || m.name } : m
                            ));
                            setEditingMedId(null);
                          }}
                          returnKeyType="done"
                          autoFocus
                          style={[reviewStyles.medEditInput, { color: colors.text }]}
                        />
                      ) : (
                        <TouchableOpacity
                          style={{ flex: 1 }}
                          onPress={() => handleFieldDoubleTap(`med_${item.id}`, () => {
                            setEditingMedId(item.id);
                            setEditingMedValue(item.name);
                            setEditingProcId(null);
                          })}
                          activeOpacity={0.8}
                        >
                          {item.brandName ? (
                            <Text style={[reviewStyles.medName, { color: colors.text }]}>
                              {item.brandName}{' '}
                              <Text style={reviewStyles.medNameSecondary}>({item.name})</Text>
                            </Text>
                          ) : (
                            <Text style={[reviewStyles.medName, { color: colors.text }]}>{item.name}</Text>
                          )}
                        </TouchableOpacity>
                      )}
                      {editingMedId !== item.id && (
                        <View style={reviewStyles.sourceBadge}>
                          <Text style={reviewStyles.sourceBadgeText}>Health Records</Text>
                        </View>
                      )}
                    </View>
                  ))
                ) : (
                  <Text style={[reviewStyles.noneFound, { color: colors.icon }]}>
                    None found in health records
                  </Text>
                )}
              </View>
            </View>

            {/* Other medications not captured from health records */}
            <View style={[reviewStyles.card, { backgroundColor: sectionBg, marginTop: 12 }]}>
              <Text style={[reviewStyles.cardSectionTitle, { color: colors.icon }]}>
                OTHER MEDICATIONS
              </Text>
              <View style={reviewStyles.medGroup}>
                {otherMeds.length === 0 && (
                  <Text style={[reviewStyles.noneFound, { color: colors.icon }]}>
                    None
                  </Text>
                )}
                {otherMeds.map(item => (
                  <View key={item.id} style={reviewStyles.medItem}>
                    <Text style={[reviewStyles.medBullet, { color: StanfordColors.cardinal }]}>•</Text>
                    {editingMedId === item.id ? (
                      <TextInput
                        value={editingMedValue}
                        onChangeText={setEditingMedValue}
                        onSubmitEditing={() => {
                          const trimmed = editingMedValue.trim();
                          if (trimmed) {
                            setOtherMeds(prev => prev.map(m =>
                              m.id === item.id ? { ...m, name: trimmed } : m
                            ));
                          } else {
                            setOtherMeds(prev => prev.filter(m => m.id !== item.id));
                          }
                          setEditingMedId(null);
                        }}
                        returnKeyType="done"
                        autoFocus
                        placeholder="Medication name"
                        placeholderTextColor={colors.icon}
                        style={[reviewStyles.medEditInput, { color: colors.text }]}
                      />
                    ) : (
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => handleFieldDoubleTap(`othermed_${item.id}`, () => {
                          setEditingMedId(item.id);
                          setEditingMedValue(item.name);
                          setEditingProcId(null);
                        })}
                        activeOpacity={0.8}
                      >
                        <Text style={[reviewStyles.medName, { color: colors.text }]}>{item.name}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity
                  style={reviewStyles.addMedButton}
                  onPress={() => {
                    const newId = `other_custom_${Date.now()}`;
                    setOtherMeds(prev => [...prev, { id: newId, name: '', groupKey: 'other' }]);
                    setEditingMedId(newId);
                    setEditingMedValue('');
                    setEditingProcId(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[reviewStyles.addMedButtonText, { color: StanfordColors.cardinal }]}>
                    + Add Medication
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        );
      }

      case 2: {
        return (
          <View style={[reviewStyles.card, { backgroundColor: sectionBg }]}>
            <ProcedureSection
              label="BPH / PROSTATE PROCEDURES"
              items={editableProcs.filter(p => p.isBPH)}
            />
            <View style={[reviewStyles.divider, { backgroundColor: borderColor }]} />
            <ProcedureSection
              label="OTHER SURGERIES"
              items={editableProcs.filter(p => !p.isBPH)}
            />
          </View>
        );
      }

      case 3: {
        const labs = prefillData.labs;

        function formatLabValue(val: number | undefined, unit: string | undefined): string | null {
          if (val == null) return null;
          return unit ? `${val} ${unit}` : String(val);
        }

        function LabRow({
          label,
          lab,
          description,
        }: {
          label: string;
          lab: typeof labs.psa;
          description: string;
        }) {
          const found = lab.confidence !== 'none' && lab.value != null;
          const displayValue = found ? formatLabValue(lab.value?.value, lab.value?.unit) : null;
          const date = found && lab.value?.date ? formatShortDate(lab.value.date) : null;
          const refRange = found && lab.value?.referenceRange ? lab.value.referenceRange : null;

          return (
            <View style={[reviewStyles.labRow, { borderBottomColor: borderColor }]}>
              <View style={reviewStyles.labLeft}>
                <Text style={[reviewStyles.labName, { color: colors.text }]}>{label}</Text>
                <Text style={[reviewStyles.labDescription, { color: colors.icon }]}>{description}</Text>
              </View>
              <View style={reviewStyles.labRight}>
                {found && displayValue ? (
                  <>
                    <Text style={[reviewStyles.labValue, { color: colors.text }]}>{displayValue}</Text>
                    {(date || refRange) && (
                      <Text style={[reviewStyles.labMeta, { color: colors.icon }]}>
                        {[date, refRange ? `Ref: ${refRange}` : null].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                    <View style={reviewStyles.sourceBadge}>
                      <Text style={reviewStyles.sourceBadgeText}>Health Records</Text>
                    </View>
                  </>
                ) : (
                  <Text style={[reviewStyles.willAskText, { color: colors.icon }]}>Not found</Text>
                )}
              </View>
            </View>
          );
        }

        return (
          <View style={[reviewStyles.card, { backgroundColor: sectionBg }]}>
            <Text style={[reviewStyles.cardSectionTitle, { color: colors.icon }]}>
              LAB RESULTS FROM HEALTH RECORDS
            </Text>
            <LabRow
              label="PSA"
              lab={labs.psa}
              description="Prostate-Specific Antigen"
            />
            <LabRow
              label="HbA1c"
              lab={labs.hba1c}
              description="Hemoglobin A1c (blood sugar)"
            />
            <LabRow
              label="Urinalysis"
              lab={labs.urinalysis}
              description="Urine test panel"
            />
          </View>
        );
      }

      case 4: {
        const conditions = prefillData.conditions;

        const allConditions = [
          ...(conditions.diabetes.value ?? []),
          ...(conditions.hypertension.value ?? []),
          ...(conditions.bph.value ?? []),
          ...(conditions.other.value ?? []),
        ];

        return (
          <>
            {/* Health-record conditions */}
            <View style={[reviewStyles.card, { backgroundColor: sectionBg }]}>
              <Text style={[reviewStyles.cardSectionTitle, { color: colors.icon }]}>
                CONDITIONS FROM HEALTH RECORDS
              </Text>
              <View style={reviewStyles.medGroup}>
                {allConditions.length > 0 ? (
                  allConditions.map((cond, ci) => (
                    <View key={ci} style={reviewStyles.medItem}>
                      <Text style={[reviewStyles.medBullet, { color: StanfordColors.cardinal }]}>•</Text>
                      <Text style={[reviewStyles.medName, { color: colors.text, flex: 1 }]}>
                        {cond.name}
                      </Text>
                      <View style={reviewStyles.sourceBadge}>
                        <Text style={reviewStyles.sourceBadgeText}>Health Records</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={[reviewStyles.noneFound, { color: colors.icon }]}>
                    No conditions found in health records
                  </Text>
                )}
              </View>
            </View>

            {/* User-added conditions */}
            <View style={[reviewStyles.card, { backgroundColor: sectionBg, marginTop: 12 }]}>
              <Text style={[reviewStyles.cardSectionTitle, { color: colors.icon }]}>
                OTHER CONDITIONS
              </Text>
              <View style={reviewStyles.medGroup}>
                {otherConds.length === 0 && (
                  <Text style={[reviewStyles.noneFound, { color: colors.icon }]}>None</Text>
                )}
                {otherConds.map(item => (
                  <View key={item.id} style={reviewStyles.medItem}>
                    <Text style={[reviewStyles.medBullet, { color: StanfordColors.cardinal }]}>•</Text>
                    {editingCondId === item.id ? (
                      <TextInput
                        value={editingCondValue}
                        onChangeText={setEditingCondValue}
                        onSubmitEditing={() => {
                          const trimmed = editingCondValue.trim();
                          if (trimmed) {
                            setOtherConds(prev => prev.map(c =>
                              c.id === item.id ? { ...c, name: trimmed } : c
                            ));
                          } else {
                            setOtherConds(prev => prev.filter(c => c.id !== item.id));
                          }
                          setEditingCondId(null);
                        }}
                        returnKeyType="done"
                        autoFocus
                        placeholder="Condition name"
                        placeholderTextColor={colors.icon}
                        style={[reviewStyles.medEditInput, { color: colors.text }]}
                      />
                    ) : (
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => handleFieldDoubleTap(`cond_${item.id}`, () => {
                          setEditingCondId(item.id);
                          setEditingCondValue(item.name);
                          setEditingMedId(null);
                          setEditingProcId(null);
                        })}
                        activeOpacity={0.8}
                      >
                        <Text style={[reviewStyles.medName, { color: colors.text }]}>{item.name}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity
                  style={reviewStyles.addMedButton}
                  onPress={() => {
                    const newId = `cond_custom_${Date.now()}`;
                    setOtherConds(prev => [...prev, { id: newId, name: '' }]);
                    setEditingCondId(newId);
                    setEditingCondValue('');
                    setEditingMedId(null);
                    setEditingProcId(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[reviewStyles.addMedButtonText, { color: StanfordColors.cardinal }]}>
                    + Add Condition
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        );
      }

      case 5: {
        const cm = prefillData.clinicalMeasurements;

        function ClinicalRow({
          label,
          description,
          value,
          unit,
          date,
          referenceRange,
          found,
        }: {
          label: string;
          description: string;
          value?: number | string | null;
          unit?: string;
          date?: string;
          referenceRange?: string;
          found: boolean;
        }) {
          const displayValue = found && value != null
            ? (unit ? `${value} ${unit}` : String(value))
            : null;
          const meta = [
            date ? formatShortDate(date) : null,
            referenceRange ? `Ref: ${referenceRange}` : null,
          ].filter(Boolean).join(' · ');

          return (
            <View style={[reviewStyles.labRow, { borderBottomColor: borderColor }]}>
              <View style={reviewStyles.labLeft}>
                <Text style={[reviewStyles.labName, { color: colors.text }]}>{label}</Text>
                <Text style={[reviewStyles.labDescription, { color: colors.icon }]}>{description}</Text>
              </View>
              <View style={reviewStyles.labRight}>
                {displayValue ? (
                  <>
                    <Text style={[reviewStyles.labValue, { color: colors.text }]}>{displayValue}</Text>
                    {meta ? (
                      <Text style={[reviewStyles.labMeta, { color: colors.icon }]}>{meta}</Text>
                    ) : null}
                    <View style={reviewStyles.sourceBadge}>
                      <Text style={reviewStyles.sourceBadgeText}>Health Records</Text>
                    </View>
                  </>
                ) : (
                  <Text style={[reviewStyles.willAskText, { color: colors.icon }]}>Not found</Text>
                )}
              </View>
            </View>
          );
        }

        return (
          <View style={[reviewStyles.card, { backgroundColor: sectionBg }]}>
            <Text style={[reviewStyles.cardSectionTitle, { color: colors.icon }]}>
              CLINICAL MEASUREMENTS FROM HEALTH RECORDS
            </Text>
            <ClinicalRow
              label="PVR"
              description="Post-Void Residual volume"
              value={cm.pvr.value?.value}
              unit={cm.pvr.value?.unit}
              date={cm.pvr.value?.date}
              referenceRange={cm.pvr.value?.referenceRange}
              found={cm.pvr.confidence !== 'none'}
            />
            <ClinicalRow
              label="Uroflow Qmax"
              description="Maximum urinary flow rate"
              value={cm.uroflowQmax.value?.value}
              unit={cm.uroflowQmax.value?.unit}
              date={cm.uroflowQmax.value?.date}
              referenceRange={cm.uroflowQmax.value?.referenceRange}
              found={cm.uroflowQmax.confidence !== 'none'}
            />
            <ClinicalRow
              label="Volume Voided"
              description="Urine volume per void (mL)"
              value={cm.volumeVoided.value?.value}
              unit={cm.volumeVoided.value?.unit}
              date={cm.volumeVoided.value?.date}
              referenceRange={cm.volumeVoided.value?.referenceRange}
              found={cm.volumeVoided.confidence !== 'none'}
            />
          </View>
        );
      }

      default:
        return null;
    }
  }

  // ── Loading phase ─────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <OnboardingProgressBar currentStep={OnboardingStep.MEDICAL_HISTORY} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={StanfordColors.cardinal} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Checking your health records...
          </Text>
          <Text style={[styles.loadingSubtext, { color: colors.icon }]}>
            Looking for medications, conditions, and procedures
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Reviewing phase ───────────────────────────────────────────────

  if (phase === 'reviewing' || phase === 'complete') {
    const isLastStep = reviewStep === 5;

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <OnboardingProgressBar currentStep={OnboardingStep.MEDICAL_HISTORY} />
        </View>

        {/* Step indicator and title — hidden on completion screen */}
        {phase !== 'complete' && (
          <>
            <View style={reviewStyles.stepHeader}>
              <View style={reviewStyles.stepDots}>
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <View
                    key={i}
                    style={[
                      reviewStyles.stepDot,
                      i < reviewStep
                        ? { backgroundColor: StanfordColors.cardinal, opacity: 0.5 }
                        : i === reviewStep
                        ? { backgroundColor: StanfordColors.cardinal }
                        : { backgroundColor: colors.border },
                    ]}
                  />
                ))}
              </View>
              <Text style={[reviewStyles.stepCounter, { color: colors.icon }]}>
                Step {reviewStep + 1} of 6
              </Text>
            </View>

            <View style={reviewStyles.titleRow}>
              <Text style={[reviewStyles.stepTitle, { color: colors.text }]}>
                {STEP_TITLES[reviewStep]}
              </Text>
              <Text style={[reviewStyles.stepDesc, { color: colors.icon }]}>
                {STEP_DESCRIPTIONS[reviewStep]}
              </Text>
            </View>
          </>
        )}

        {/* Step content or completion screen */}
        {phase === 'complete' ? (
          <Animated.View style={[styles.completeContainer, { opacity: confirmFade }]}>
            <IconSymbol name="checkmark.circle.fill" size={64} color="#34C759" />
            <Text style={[styles.completeTitle, { color: colors.text }]}>
              All Confirmed
            </Text>
            <Text style={[styles.completeSubtitle, { color: colors.icon }]}>
              Your health records have been reviewed. You&apos;re ready to continue.
            </Text>
            <ContinueButton
              title="Continue to Baseline Survey"
              onPress={handleContinue}
              style={{ marginTop: Spacing.lg }}
            />
          </Animated.View>
        ) : (
          <>
            <Animated.View style={[{ flex: 1 }, { opacity: stepFade }]}>
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={reviewStyles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {renderStepContent()}
              </ScrollView>
            </Animated.View>

            <View style={[reviewStyles.actionContainer, { backgroundColor: colors.background, borderTopColor: borderColor }]}>
              <ContinueButton
                title={isLastStep ? 'Confirm All & Continue →' : 'Looks Correct →'}
                onPress={() => handleConfirmStep(false)}
              />
              <TouchableOpacity
                style={reviewStyles.correctionButton}
                onPress={() => handleConfirmStep(true)}
                activeOpacity={0.7}
              >
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Bottom sheet picker for Ethnicity / Race / Biological Sex */}
        <Modal
          visible={pickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setPickerVisible(false)}
        >
          <Pressable style={reviewStyles.pickerBackdrop} onPress={() => setPickerVisible(false)}>
            <Pressable style={[reviewStyles.pickerSheet, { backgroundColor: sectionBg }]}>
              <View style={[reviewStyles.pickerHandle, { backgroundColor: borderColor }]} />
              <Text style={[reviewStyles.pickerTitle, { color: colors.icon }]}>
                {pickerField === 'ethnicity' ? 'ETHNICITY' : pickerField === 'race' ? 'RACE' : 'BIOLOGICAL SEX'}
              </Text>
              {(pickerField === 'ethnicity' ? ETHNICITY_OPTIONS : pickerField === 'race' ? RACE_OPTIONS : SEX_OPTIONS).map(option => {
                const selected = pickerField === 'ethnicity'
                  ? demoEthnicity === option
                  : pickerField === 'race'
                  ? demoRace === option
                  : demoBiologicalSex === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[reviewStyles.pickerOption, { borderBottomColor: borderColor }]}
                    onPress={() => handlePickerSelect(option)}
                    activeOpacity={0.7}
                  >
                    <Text style={[reviewStyles.pickerOptionText, { color: colors.text }]}>
                      {option}
                    </Text>
                    {selected && (
                      <IconSymbol name="checkmark" size={16} color={StanfordColors.cardinal} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </Pressable>
          </Pressable>
        </Modal>

      </SafeAreaView>
    );
  }
}

// ── Review-specific styles ────────────────────────────────────────────

const reviewStyles = StyleSheet.create({
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  stepDots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepCounter: {
    fontSize: 13,
    fontWeight: '500',
  },
  titleRow: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: 4,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  stepDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    gap: 0,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  cardSectionTitleInRow: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 46,
  },
  dataLabel: {
    fontSize: 15,
    fontWeight: '400',
    flex: 1,
  },
  dataRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  dataValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  willAskText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  sourceBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2E7D32',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.md,
  },
  medGroup: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 6,
  },
  medGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  medItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  medBullet: {
    fontSize: 16,
    lineHeight: 20,
  },
  medName: {
    fontSize: 15,
    flex: 1,
    fontWeight: '500',
  },
  medNameSecondary: {
    fontSize: 13,
    fontWeight: '400',
    opacity: 0.6,
  },
  procNameRow: {
    flex: 1,
    gap: 2,
  },
  procDate: {
    fontSize: 12,
  },
  noneFound: {
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 2,
  },
  addMedButton: {
    marginTop: 10,
    paddingVertical: 8,
  },
  addMedButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  actionContainer: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  correctionButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  correctionText: {
    fontSize: 14,
  },
  inlineInput: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 22,
  },
  selectHint: {
    fontSize: 15,
    fontWeight: '500',
  },
  medEditInput: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  pickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 4,
    paddingHorizontal: Spacing.screenHorizontal,
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerOptionText: {
    fontSize: 17,
  },
  labRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  labLeft: {
    flex: 1,
    gap: 2,
  },
  labName: {
    fontSize: 15,
    fontWeight: '600',
  },
  labDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  labRight: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 1,
  },
  labValue: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'right',
  },
  labMeta: {
    fontSize: 11,
    textAlign: 'right',
  },
});

// ── Shared styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  completeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenHorizontal,
    gap: Spacing.md,
  },
  completeTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  completeSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.screenHorizontal,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
  },
  loadingSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
