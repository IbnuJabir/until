import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNativeEvents } from '@/app/src/hooks/useNativeEvents';
import { useReminderStore } from '@/app/src/store/reminderStore';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { fireReminder } = useReminderStore();

  // Initialize native event listeners
  useNativeEvents();

  // Handle notification received (mark reminder as fired)
  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener(
      async (notification) => {
        const reminderId = notification.request.content.data?.reminderId;

        if (reminderId && typeof reminderId === 'string') {
          console.log('[App] Scheduled notification received, marking reminder as fired:', reminderId);

          try {
            await fireReminder(reminderId);
            console.log('[App] ✅ Reminder marked as fired:', reminderId);
          } catch (error) {
            console.error('[App] Failed to mark reminder as fired:', error);
          }
        }
      }
    );

    return () => {
      receivedSubscription.remove();
    };
  }, [fireReminder]);

  // Handle notification tap (deep link to reminder detail)
  useEffect(() => {
    // Handle notification tap when app is already running
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const reminderId = response.notification.request.content.data?.reminderId;

        if (reminderId && typeof reminderId === 'string') {
          console.log('[App] Notification tapped, navigating to reminder:', reminderId);

          // Navigate to reminder detail page
          // Use setTimeout to ensure navigation stack is ready
          setTimeout(() => {
            router.push(`/reminder-detail?id=${reminderId}` as any);
          }, 100);
        }
      }
    );

    // Handle app launch from notification (cold start)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const reminderId = response.notification.request.content.data?.reminderId;

        if (reminderId && typeof reminderId === 'string') {
          console.log('[App] App launched from notification, navigating to reminder:', reminderId);

          // Navigate to reminder detail page after a delay to ensure stack is ready
          setTimeout(() => {
            router.push(`/reminder-detail?id=${reminderId}` as any);
          }, 500);
        }
      }
    });

    return () => {
      responseSubscription.remove();
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
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
