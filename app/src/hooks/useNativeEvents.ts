/**
 * Hook to subscribe to native system events
 * Connects native modules to the Zustand store
 */

import { useEffect } from 'react';
import { useReminderStore } from '../store/reminderStore';
import { subscribeToAppBecameActive } from '../native-bridge/AppLifecycleBridge';
import { SystemEventType, ReminderStatus } from '../domain';

export function useNativeEvents() {
  const handleEvent = useReminderStore((state) => state.handleEvent);
  const reminders = useReminderStore((state) => state.reminders);
  const loadFromStorage = useReminderStore((state) => state.loadFromStorage);

  // Load reminders from database on mount
  useEffect(() => {
    console.log('[useNativeEvents] Loading reminders from database...');
    loadFromStorage().then(() => {
      console.log('[useNativeEvents] Database loaded successfully');
    }).catch((error) => {
      console.error('[useNativeEvents] Failed to load database:', error);
    });
  }, []);

  useEffect(() => {
    console.log('[useNativeEvents] Setting up native event listeners...');
    console.log('[useNativeEvents] Current reminders count:', reminders.length);

    // Subscribe to phone unlock / app became active events
    const unsubscribeAppLifecycle = subscribeToAppBecameActive((event) => {
      console.log('=================================================');
      console.log('[useNativeEvents] 🔔 APP_BECAME_ACTIVE event received!');
      console.log('[useNativeEvents] Event timestamp:', new Date(event.timestamp).toISOString());
      console.log('[useNativeEvents] Active reminders:', reminders.filter(r => r.status === ReminderStatus.WAITING).length);
      console.log('=================================================');

      handleEvent(event).catch((error) => {
        console.error('[useNativeEvents] Error handling event:', error);
      });
    });

    // TODO Phase 6: Add battery, location, and screen time subscriptions
    // const unsubscribeBattery = subscribeToBatteryEvents((event) => {
    //   handleEvent(event);
    // });

    // Cleanup on unmount
    return () => {
      console.log('[useNativeEvents] Cleaning up native event listeners...');
      unsubscribeAppLifecycle();
    };
  }, [handleEvent, reminders.length]);
}
