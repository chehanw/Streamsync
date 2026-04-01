/**
 * Notification Service
 *
 * Manages local push notifications that remind users to sync their
 * Apple Watch and Throne device if no new data is detected in 48 hours.
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { STORAGE_KEYS } from '../constants';
import { getDailyActivity } from './healthkit/HealthKitClient';
import { ThroneService } from './throne-service';

const HOURS_48 = 48 * 60 * 60 * 1000;
const HOURS_24 = 24 * 60 * 60 * 1000;

const NOTIFICATION_IDS = {
  healthkit: 'homeflow-healthkit-reminder',
  throne: 'homeflow-throne-reminder',
} as const;

type DataSource = keyof typeof NOTIFICATION_IDS;

// Configure how notifications are presented when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const NOTIFICATION_CONTENT: Record<DataSource, { title: string; body: string }> = {
  healthkit: {
    title: 'Apple Watch not syncing',
    body: "It looks like you haven't worn your Apple Watch in the last 48 hours. Please put it on to continue tracking your health!",
  },
  throne: {
    title: 'Throne device reminder',
    body: "We haven't recorded a urinary flow reading in the past 48 hours. Use your Throne device to continue tracking your progress!",
  },
};

/**
 * Request notification permissions from the user.
 * Returns true if granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Cancel any pending notification for the given source and schedule
 * a new one to fire after `delayMs` milliseconds.
 */
async function scheduleReminder(source: DataSource, delayMs: number): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDS[source]).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_IDS[source],
    content: {
      title: NOTIFICATION_CONTENT[source].title,
      body: NOTIFICATION_CONTENT[source].body,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.round(delayMs / 1000),
    },
  });
}

/**
 * Fire an immediate notification (shown right away as a banner).
 * Throttled to once per 24h per source via AsyncStorage.
 */
async function fireImmediateReminder(source: DataSource): Promise<void> {
  const storageKey = source === 'healthkit'
    ? STORAGE_KEYS.LAST_NOTIFICATION_HEALTHKIT
    : STORAGE_KEYS.LAST_NOTIFICATION_THRONE;

  const lastFiredStr = await AsyncStorage.getItem(storageKey);
  if (lastFiredStr) {
    const lastFired = parseInt(lastFiredStr, 10);
    if (Date.now() - lastFired < HOURS_24) return; // already notified today
  }

  await Notifications.scheduleNotificationAsync({
    identifier: `${NOTIFICATION_IDS[source]}-immediate`,
    content: {
      title: NOTIFICATION_CONTENT[source].title,
      body: NOTIFICATION_CONTENT[source].body,
    },
    trigger: null, // fires immediately
  });

  await AsyncStorage.setItem(storageKey, Date.now().toString());
}

/**
 * Check if HealthKit has data in the last 48 hours.
 * Returns true if recent data exists.
 */
async function hasRecentHealthKitData(): Promise<boolean> {
  if (Platform.OS !== 'ios') return true; // non-iOS: don't nag

  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - HOURS_48);

    const activity = await getDailyActivity({ startDate: cutoff, endDate: now });

    // Check if any day has non-zero steps or activity
    const hasActivity = activity.some(
      (day) => day.steps > 0 || day.activeEnergyBurned > 0 || day.exerciseMinutes > 0
    );

    return hasActivity;
  } catch {
    return true; // on error, assume data exists (don't spam user)
  }
}

/**
 * Check if Throne has data in the last 48 hours.
 * Returns true if a recent measurement exists.
 */
async function hasRecentThroneData(): Promise<boolean> {
  try {
    const latest = await ThroneService.getLatestMeasurement();
    if (!latest) return false;

    const age = Date.now() - new Date(latest.timestamp).getTime();
    return age < HOURS_48;
  } catch {
    return true; // on error, assume data exists
  }
}

/**
 * DEV ONLY: Fire an immediate notification for a specific source,
 * bypassing the 24h throttle. Useful for testing notification appearance.
 */
export async function triggerTestNotification(source: DataSource): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: `${NOTIFICATION_IDS[source]}-test`,
    content: {
      title: `[TEST] ${NOTIFICATION_CONTENT[source].title}`,
      body: NOTIFICATION_CONTENT[source].body,
    },
    trigger: null, // fires immediately
  });
}

/**
 * Main entry point. Call this whenever the app comes to the foreground.
 *
 * For each data source:
 * - If data found within 48h → reschedule reminder 48h from now
 * - If no data found → fire an immediate reminder (once per 24h)
 */
export async function checkAndScheduleReminders(): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const [healthKitOk, throneOk] = await Promise.all([
    hasRecentHealthKitData(),
    hasRecentThroneData(),
  ]);

  if (healthKitOk) {
    await scheduleReminder('healthkit', HOURS_48);
  } else {
    await fireImmediateReminder('healthkit');
  }

  if (throneOk) {
    await scheduleReminder('throne', HOURS_48);
  } else {
    await fireImmediateReminder('throne');
  }
}
