/**
 * Notification Service
 * Follows CONTEXT.md Phase 5 - Local notifications only
 *
 * Requirements:
 * - Fire once per reminder
 * - Cancel future notifications after fire
 * - No background fetch required
 */

import * as Notifications from 'expo-notifications';
import { Reminder } from '../domain';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Permission denied');
      return false;
    }

    console.log('[Notifications] Permission granted');
    return true;
  } catch (error) {
    console.error('[Notifications] Failed to request permissions:', error);
    return false;
  }
}

/**
 * Get notification permission status
 */
export async function getNotificationPermissionStatus(): Promise<string> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch (error) {
    console.error('[Notifications] Failed to get permission status:', error);
    return 'undetermined';
  }
}

/**
 * Schedule a notification to fire at a specific date/time
 */
export async function scheduleNotificationAtTime(
  reminder: Reminder,
  scheduledDateTime: number
): Promise<string> {
  try {
    // Check permission first
    const hasPermission = await requestNotificationPermissions();

    if (!hasPermission) {
      throw new Error('Notification permission not granted');
    }

    // Validate that the scheduled time is in the future
    if (scheduledDateTime <= Date.now()) {
      throw new Error('Scheduled time must be in the future');
    }

    // Schedule notification for specific timestamp
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.description || 'Your reminder is ready',
        data: {
          reminderId: reminder.id,
          firedAt: Date.now(),
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        // iOS 15+ time-sensitive notifications
        interruptionLevel: 'timeSensitive' as any,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: scheduledDateTime,
      } as Notifications.DateTriggerInput,
    });

    console.log(`[Notifications] Scheduled notification ${notificationId} for reminder: ${reminder.title} at ${new Date(scheduledDateTime).toISOString()}`);

    return notificationId;
  } catch (error) {
    console.error('[Notifications] Failed to schedule notification:', error);
    throw error;
  }
}

/**
 * Fire a local notification for a reminder (immediately)
 */
export async function fireNotification(reminder: Reminder): Promise<string> {
  try {
    // Check permission first
    const hasPermission = await requestNotificationPermissions();

    if (!hasPermission) {
      throw new Error('Notification permission not granted');
    }

    // Schedule immediate notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.description || 'Your reminder is ready',
        data: {
          reminderId: reminder.id,
          firedAt: Date.now(),
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        // iOS 15+ time-sensitive notifications (like Calendar/Reminders apps)
        // This makes the notification more prominent with louder sound and longer display
        interruptionLevel: 'timeSensitive' as any, // Type not exported but supported by expo-notifications
      },
      trigger: null, // Fire immediately
    });

    console.log(`[Notifications] Fired notification ${notificationId} for reminder: ${reminder.title}`);

    return notificationId;
  } catch (error) {
    console.error('[Notifications] Failed to fire notification:', error);
    throw error;
  }
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`[Notifications] Cancelled notification: ${notificationId}`);
  } catch (error) {
    console.error('[Notifications] Failed to cancel notification:', error);
    throw error;
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[Notifications] Cancelled all notifications');
  } catch (error) {
    console.error('[Notifications] Failed to cancel all notifications:', error);
    throw error;
  }
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('[Notifications] Failed to get scheduled notifications:', error);
    return [];
  }
}

/**
 * Subscribe to notification responses (user taps notification)
 */
export function subscribeToNotificationResponses(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Subscribe to notifications received while app is foregrounded
 */
export function subscribeToNotificationsReceived(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}
