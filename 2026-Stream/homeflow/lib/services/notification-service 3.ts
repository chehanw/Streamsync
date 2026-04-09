/**
 * Notification Service
 *
 * Notification support is temporarily disabled for iOS crash isolation.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  return false;
}

export async function triggerTestNotification(): Promise<void> {
  return;
}

export async function checkAndScheduleReminders(): Promise<void> {
  return;
}
