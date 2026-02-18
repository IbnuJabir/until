import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNativeEvents } from '@/app/src/hooks/useNativeEvents';
import { useReminderStore } from '@/app/src/store/reminderStore';
import {
  clearBadgeCount,
  checkPermissionsOnLaunch,
  setupNotificationCategories,
  pruneStaleNotifications,
} from '@/app/src/utils/NotificationService';
import { initCrashReporter } from '@/app/src/utils/CrashReporter';
import { initAnalytics, Analytics } from '@/app/src/utils/Analytics';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { fireReminder } = useReminderStore();
  const coldStartHandledRef = useRef(false);

  // Initialize native event listeners
  useNativeEvents();

  // Initialize crash reporter (production only) and analytics
  useEffect(() => {
    if (!__DEV__) {
      initCrashReporter();
    }
    initAnalytics().then(() => {
      Analytics.appLaunched();
    });
  }, []);

  // Check if onboarding is complete, redirect if not
  useEffect(() => {
    AsyncStorage.getItem('@onboarding_complete').then((value) => {
      if (value !== 'true') {
        router.replace('/onboarding' as any);
      }
    });
  }, []);

  // Set up notification categories, check permissions, clear badge, prune stale notifications
  useEffect(() => {
    // Set up notification action categories (e.g. "Mark as Done")
    setupNotificationCategories();

    // Clear badge on launch
    clearBadgeCount();

    // Check notification permissions on cold start (show alert if revoked)
    checkPermissionsOnLaunch();

    // Prune stale scheduled notifications
    const store = useReminderStore.getState();
    const activeIds = store.reminders
      .filter((r) => r.status === 'waiting')
      .map((r) => r.id);
    pruneStaleNotifications(activeIds);

    // Prune old fired/expired reminders and unused saved places from database
    import('@/app/src/storage/database').then(({ pruneFiredReminders, pruneUnusedSavedPlaces }) => {
      pruneFiredReminders();
      pruneUnusedSavedPlaces();
    });

    // Listen to app state changes
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // Clear badge when returning to foreground
        clearBadgeCount();
        // Re-check notification permissions on resume (in case user revoked in Settings)
        checkPermissionsOnLaunch();
      } else if (nextState === 'background') {
        // Auto-save state when app goes to background
        useReminderStore.getState().saveToStorage().catch((error) => {
          console.error('[App] Failed to auto-save on background:', error);
        });
      }
    });

    return () => subscription.remove();
  }, []);

  // Handle notification received (emit SCHEDULED_TIME_FIRED event for rule engine evaluation)
  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      async (notification) => {
        const reminderId = notification.request.content.data?.reminderId;

        if (reminderId && typeof reminderId === 'string') {
          if (__DEV__) {
            console.log('[App] Scheduled notification received for reminder:', reminderId);
          }

          try {
            const { useReminderStore } = await import('@/app/src/store/reminderStore');
            const { SystemEventType } = await import('@/app/src/domain');
            const store = useReminderStore.getState();

            const scheduledTimeEvent = {
              type: SystemEventType.SCHEDULED_TIME_FIRED,
              timestamp: Date.now(),
              data: {
                reminderId,
              },
            };

            await store.handleEvent(scheduledTimeEvent);
          } catch (error) {
            console.error('[App] Failed to handle scheduled time event:', error);
          }
        }
      }
    );

    return () => {
      receivedSubscription.remove();
    };
  }, []);

  // Handle "Mark as Done" notification action
  useEffect(() => {
    const actionSubscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const actionId = response.actionIdentifier;
        const reminderId = response.notification.request.content.data?.reminderId;

        if (actionId === 'MARK_DONE' && reminderId && typeof reminderId === 'string') {
          if (__DEV__) {
            console.log('[App] Mark as Done action for reminder:', reminderId);
          }
          try {
            const store = useReminderStore.getState();
            await store.fireReminder(reminderId);
          } catch (error) {
            console.error('[App] Failed to mark reminder as done:', error);
          }
          return;
        }

        // Default: navigate to reminder detail on tap
        if (reminderId && typeof reminderId === 'string' && actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          if (__DEV__) {
            console.log('[App] Notification tapped, navigating to reminder:', reminderId);
          }

          setTimeout(() => {
            router.push(`/reminder-detail?id=${reminderId}` as any);
          }, 100);
        }
      }
    );

    // Handle app launch from notification (cold start) - only once
    if (!coldStartHandledRef.current) {
      coldStartHandledRef.current = true;
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) {
          const reminderId = response.notification.request.content.data?.reminderId;

          if (reminderId && typeof reminderId === 'string') {
            if (__DEV__) {
              console.log('[App] App launched from notification, navigating to reminder:', reminderId);
            }

            setTimeout(() => {
              router.push(`/reminder-detail?id=${reminderId}` as any);
            }, 500);
          }
        }
      });
    }

    return () => {
      actionSubscription.remove();
    };
  }, [router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen
          name="create-reminder"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="paywall"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="reminder-detail"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="voice-reminder"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="debug-db"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="onboarding"
          options={{
            headerShown: false,
            animation: 'fade',
            gestureEnabled: false,
          }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
