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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking } from 'react-native';
import { Reminder } from '../domain';

// Notification category identifier
const REMINDER_CATEGORY = 'reminder';
const NOTIFICATION_SOUND_KEY = '@notification_sound_enabled';

/**
 * Read user's notification sound preference
 */
async function isSoundEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(NOTIFICATION_SOUND_KEY);
    return val !== 'false'; // Default is true
  } catch {
    return true;
  }
}

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Set up notification categories with action buttons
 */
export async function setupNotificationCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
      {
        identifier: 'MARK_DONE',
        buttonTitle: 'Mark as Done',
        options: { opensAppToForeground: false },
      },
    ]);
    if (__DEV__) {
      console.log('[Notifications] Notification categories set up');
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[Notifications] Failed to set up categories:', error);
    }
  }
}

/**
 * Clear notification badge count
 */
export async function clearBadgeCount(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    if (__DEV__) {
      console.error('[Notifications] Failed to clear badge:', error);
    }
  }
}

/**
 * Open device notification settings for this app
 */
export function openNotificationSettings(): void {
  Linking.openSettings();
}

/**
 * Show permission denied alert with "Open Settings" CTA
 */
function showPermissionDeniedAlert(): void {
  Alert.alert(
    'Notifications Disabled',
    'Until needs notification permissions to deliver your reminders. Please enable them in Settings.',
    [
      { text: 'Not Now', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => Linking.openSettings(),
      },
    ]
  );
}

/**
 * Request notification permissions
 * Shows an alert with "Open Settings" CTA if permission is denied
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
      if (__DEV__) {
        console.warn('[Notifications] Permission denied');
      }
      showPermissionDeniedAlert();
      return false;
    }

    if (__DEV__) {
      console.log('[Notifications] Permission granted');
    }
    return true;
  } catch (error) {
    console.error('[Notifications] Failed to request permissions:', error);
    return false;
  }
}

/**
 * Check notification permission status (silent - no UI)
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
 * Check permissions on cold start and show alert if revoked
 */
export async function checkPermissionsOnLaunch(): Promise<void> {
  try {
    const status = await getNotificationPermissionStatus();
    if (status !== 'granted') {
      showPermissionDeniedAlert();
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[Notifications] Failed to check permissions on launch:', error);
    }
  }
}

/**
 * Prune stale scheduled notifications that no longer have matching reminders
 */
export async function pruneStaleNotifications(activeReminderIds: string[]): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      const reminderId = notification.content.data?.reminderId;
      if (reminderId && typeof reminderId === 'string' && !activeReminderIds.includes(reminderId)) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        if (__DEV__) {
          console.log(`[Notifications] Pruned stale notification for reminder: ${reminderId}`);
        }
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.error('[Notifications] Failed to prune stale notifications:', error);
    }
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

    const soundOn = await isSoundEnabled();

    // Schedule notification for specific timestamp
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.description || 'Your reminder is ready',
        data: {
          reminderId: reminder.id,
          firedAt: Date.now(),
        },
        sound: soundOn,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        // iOS 15+ time-sensitive notifications
        interruptionLevel: 'timeSensitive' as any,
        categoryIdentifier: REMINDER_CATEGORY,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: scheduledDateTime,
      } as Notifications.DateTriggerInput,
    });

    if (__DEV__) {
      console.log(`[Notifications] Scheduled notification ${notificationId} for reminder: ${reminder.title} at ${new Date(scheduledDateTime).toISOString()}`);
    }

    return notificationId;
  } catch (error) {
    console.error('[Notifications] Failed to schedule notification:', error);
    throw error;
  }
}

/**
 * Fire a local notification for a reminder (immediately)
 * Includes retry logic for transient failures
 */
export async function fireNotification(reminder: Reminder, retries = 2): Promise<string> {
  try {
    // Check permission first
    const hasPermission = await requestNotificationPermissions();

    if (!hasPermission) {
      throw new Error('Notification permission not granted');
    }

    const soundOn = await isSoundEnabled();

    // Schedule immediate notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.description || 'Your reminder is ready',
        data: {
          reminderId: reminder.id,
          firedAt: Date.now(),
        },
        sound: soundOn,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        // iOS 15+ time-sensitive notifications (like Calendar/Reminders apps)
        interruptionLevel: 'timeSensitive' as any,
        categoryIdentifier: REMINDER_CATEGORY,
      },
      trigger: null, // Fire immediately
    });

    if (__DEV__) {
      console.log(`[Notifications] Fired notification ${notificationId} for reminder: ${reminder.title}`);
    }

    return notificationId;
  } catch (error) {
    if (retries > 0) {
      if (__DEV__) {
        console.warn(`[Notifications] Retrying notification for ${reminder.title} (${retries} retries left)`);
      }
      // Wait briefly before retry
      await new Promise((resolve) => setTimeout(resolve, 500));
      return fireNotification(reminder, retries - 1);
    }
    console.error('[Notifications] Failed to fire notification after retries:', error);
    throw error;
  }
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    if (__DEV__) {
      console.log(`[Notifications] Cancelled notification: ${notificationId}`);
    }
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
    if (__DEV__) {
      console.log('[Notifications] Cancelled all notifications');
    }
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
