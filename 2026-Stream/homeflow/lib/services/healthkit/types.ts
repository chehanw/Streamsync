/**
 * HealthKit Service Types
 *
 * Normalized data types for health metrics from Apple HealthKit.
 * All values use simple units (counts, minutes, bpm, ms, etc.)
 * with ISO timestamps and timezone info.
 */

// ── Date range for queries ──────────────────────────────────────────

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

// ── Daily Activity ──────────────────────────────────────────────────

export interface DailyActivity {
  /** YYYY-MM-DD */
  date: string;
  /** Total step count for the day */
  steps: number;
  /** Apple Exercise minutes (vigorous activity detected by Watch) */
  exerciseMinutes: number;
  /** Apple Move minutes (any movement above sedentary threshold) */
  moveMinutes: number;
  /** Apple Stand minutes (minutes with at least 1 min standing per hour) */
  standMinutes: number;
  /**
   * Estimated sedentary minutes.
   * Approximation: 960 (16h waking) - exerciseMinutes - moveMinutes - standMinutes.
   * Limitation: This is a rough estimate. Apple does not expose a direct
   * "sedentary time" metric. The calculation assumes ~16 waking hours and
   * subtracts known active periods. Actual sedentary time may differ.
   */
  sedentaryMinutes: number;
  /** Active energy burned in kcal */
  activeEnergyBurned: number;
  /** Walking + running distance in meters */
  distanceWalkingRunning: number;
}

// ── Sleep ───────────────────────────────────────────────────────────

export enum SleepStage {
  InBed = 'inBed',
  Awake = 'awake',
  Core = 'core',
  Deep = 'deep',
  REM = 'rem',
  AsleepUnspecified = 'asleepUnspecified',
}

export interface SleepSample {
  stage: SleepStage;
  startDate: string; // ISO 8601
  endDate: string;   // ISO 8601
  durationMinutes: number;
}

export interface SleepNight {
  /** YYYY-MM-DD of the night (date sleep started) */
  date: string;
  totalAsleepMinutes: number;
  totalInBedMinutes: number;
  /** (totalAsleep / totalInBed) * 100, rounded to 1 decimal */
  sleepEfficiency: number;
  /** true if iOS 16+ detailed stage data is available */
  hasDetailedStages: boolean;
  stages: {
    awake: number;
    core: number;
    deep: number;
    rem: number;
    /** Fallback for older iOS without stage breakdown */
    asleepUndifferentiated: number;
  };
  /** Raw samples for this night */
  samples: SleepSample[];
}

// ── Vitals ──────────────────────────────────────────────────────────

export interface HeartRateStats {
  min: number;      // bpm
  max: number;      // bpm
  average: number;  // bpm
  sampleCount: number;
}

export interface VitalsSample {
  value: number;
  unit: string;
  startDate: string; // ISO 8601
  endDate: string;   // ISO 8601
  sourceName?: string;
}

export interface VitalsDay {
  /** YYYY-MM-DD */
  date: string;
  heartRate: HeartRateStats;
  /** bpm, from Apple Watch overnight analysis. null if unavailable. */
  restingHeartRate: number | null;
  /** SDNN in milliseconds. null if unavailable. */
  hrv: number | null;
  /** Breaths per minute. null if unavailable. */
  respiratoryRate: number | null;
  /** Percentage (0-100). null if unavailable. */
  oxygenSaturation: number | null;
}

// ── Permission result ───────────────────────────────────────────────

export interface HealthPermissionResult {
  success: boolean;
  /** HealthKit always returns "not determined" for read permissions (privacy). */
  note: string;
}

// ── Metrics we support vs. don't ────────────────────────────────────

/**
 * Metrics currently implemented:
 * - Step count (daily total)
 * - Exercise minutes (Apple Exercise Time)
 * - Move minutes (Apple Move Time)
 * - Stand minutes (Apple Stand Time)
 * - Sedentary time (estimated)
 * - Active energy burned
 * - Distance walking/running
 * - Sleep stages (Core/Deep/REM/Awake) with iOS 16+ fallback
 * - Heart rate (min/avg/max per day)
 * - Resting heart rate
 * - Heart rate variability (HRV SDNN)
 * - Respiratory rate
 * - Oxygen saturation (SpO2)
 *
 * Metrics NOT currently implemented but available via HealthKit + Apple Watch:
 * - VO2 Max
 * - Walking heart rate average
 * - Apple Walking Steadiness
 * - Walking speed, step length, asymmetry
 * - Stair ascent/descent speed
 * - Running metrics (pace, cadence, ground contact time, power)
 * - Cycling metrics (speed, power, cadence)
 * - Blood pressure
 * - Body temperature / wrist temperature
 * - Blood glucose
 * - Electrocardiogram (ECG)
 * - Environmental/headphone audio exposure
 * - Time in daylight
 * - Workouts (detailed workout sessions)
 * - Mindfulness sessions
 */
