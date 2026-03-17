/**
 * Insight Derivation
 *
 * Pure functions that transform raw HealthKit data into plain-language
 * insights for the Daily Check-In screen. No React dependencies.
 */

import type { SleepNight, DailyActivity, VitalsDay } from '@/lib/services/healthkit';
import type {
  SleepInsight,
  ActivityInsight,
  VitalsInsight,
  VitalItem,
  HealthSummaryDay,
  InsightStatus,
} from './types';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ── Sleep ─────────────────────────────────────────────────────────────

export function deriveSleepInsight(
  tonight: SleepNight,
  recentNights: SleepNight[],
): SleepInsight {
  const totalHours = round1(tonight.totalAsleepMinutes / 60);

  // 7-day baseline average (excluding tonight)
  const validNights = recentNights.filter((n) => n.totalAsleepMinutes > 0);
  const baselineHours =
    validNights.length > 0
      ? round1(
          validNights.reduce((sum, n) => sum + n.totalAsleepMinutes, 0) /
            validNights.length /
            60,
        )
      : totalHours;

  // Status: within 15% of baseline
  const ratio = baselineHours > 0 ? totalHours / baselineHours : 1;
  let status: InsightStatus;
  if (ratio >= 0.85 && ratio <= 1.15) {
    status = 'steady';
  } else if (ratio > 1.15) {
    status = 'above-typical';
  } else {
    status = 'below-typical';
  }

  // Bar fill: clamp to 0–1 relative to baseline (cap at 1.3x)
  const barFill = baselineHours > 0 ? Math.min(totalHours / baselineHours, 1.3) / 1.3 : 0.5;

  let headline: string;
  let supportingText: string;

  if (status === 'steady') {
    headline = `You slept about ${totalHours} hours`;
    supportingText = "That's close to your usual rest pattern";
  } else if (status === 'above-typical') {
    headline = `A longer night \u2014 about ${totalHours} hours`;
    supportingText = 'A bit more rest than your recent average';
  } else {
    headline = `A shorter night \u2014 about ${totalHours} hours`;
    supportingText = "A little less than your recent average \u2014 that's OK";
  }

  const stages = tonight.hasDetailedStages
    ? {
        deep: tonight.stages.deep,
        core: tonight.stages.core,
        rem: tonight.stages.rem,
        awake: tonight.stages.awake,
      }
    : null;

  return {
    headline,
    supportingText,
    status,
    totalHours,
    baselineHours,
    barFill,
    efficiency: tonight.sleepEfficiency,
    stages,
  };
}

// ── Activity ──────────────────────────────────────────────────────────

export function deriveActivityInsight(today: DailyActivity): ActivityInsight {
  const activeMinutes = today.exerciseMinutes + today.moveMinutes;

  let headline: string;
  let supportingText: string;
  let status: InsightStatus;

  if (activeMinutes >= 30) {
    headline = 'An active day';
    supportingText = `About ${activeMinutes} minutes of movement \u2014 good energy spent`;
    status = 'steady';
  } else if (activeMinutes >= 10) {
    headline = 'Some movement today';
    supportingText = `${activeMinutes} minutes of movement so far`;
    status = 'steady';
  } else {
    headline = 'A quieter day';
    supportingText = "Your body may be resting today \u2014 that's part of the rhythm";
    status = 'below-typical';
  }

  return {
    headline,
    supportingText,
    status,
    activeMinutes,
    steps: today.steps,
    energyBurned: today.activeEnergyBurned,
    distance: today.distanceWalkingRunning,
  };
}

// ── Vitals ────────────────────────────────────────────────────────────

export function deriveVitalsInsight(today: VitalsDay): VitalsInsight {
  const items: VitalItem[] = [];

  if (today.restingHeartRate != null) {
    items.push({
      label: 'Resting heart rate',
      value: `${today.restingHeartRate} bpm`,
      status: 'steady',
    });
  }

  if (today.hrv != null) {
    items.push({
      label: 'Heart rate variability',
      value: `${today.hrv} ms`,
      status: 'steady',
    });
  }

  if (today.respiratoryRate != null) {
    items.push({
      label: 'Respiratory rate',
      value: `${today.respiratoryRate} br/min`,
      status: 'steady',
    });
  }

  if (today.oxygenSaturation != null) {
    items.push({
      label: 'Blood oxygen',
      value: `${today.oxygenSaturation}%`,
      status: 'steady',
    });
  }

  const hasData = items.length > 0;

  return {
    headline: hasData ? 'All vitals look steady' : 'No vitals recorded today',
    status: hasData ? 'steady' : 'no-data',
    items,
  };
}

// ── Orchestrator ──────────────────────────────────────────────────────

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

const NO_SLEEP: SleepInsight = {
  headline: 'No sleep data yet',
  supportingText: 'Sleep tracking will appear here when available',
  status: 'no-data',
  totalHours: 0,
  baselineHours: 0,
  barFill: 0,
  efficiency: 0,
  stages: null,
};

const NO_ACTIVITY: ActivityInsight = {
  headline: 'No activity data yet',
  supportingText: 'Activity tracking will appear here when available',
  status: 'no-data',
  activeMinutes: 0,
  steps: 0,
  energyBurned: 0,
  distance: 0,
};

const NO_VITALS: VitalsInsight = {
  headline: 'No vitals recorded yet',
  supportingText: 'Vitals will appear here when available',
  status: 'no-data',
  items: [],
};

export function buildHealthSummaryDay(
  todayDate: string,
  sleep: SleepNight | null,
  recentSleep: SleepNight[],
  activity: DailyActivity | null,
  vitals: VitalsDay | null,
): HealthSummaryDay {
  return {
    date: todayDate,
    dateLabel: formatDateLabel(todayDate),
    greeting: 'Your daily check-in',
    sleep: sleep ? deriveSleepInsight(sleep, recentSleep) : NO_SLEEP,
    activity: activity ? deriveActivityInsight(activity) : NO_ACTIVITY,
    vitals: vitals ? deriveVitalsInsight(vitals) : NO_VITALS,
    raw: { sleep, activity, vitals },
  };
}
