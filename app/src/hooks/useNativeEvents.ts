/**
 * Hook to subscribe to native system events
 * Connects native modules to the Zustand store
 */

import { useEffect, useRef } from 'react';
import { useReminderStore } from '../store/reminderStore';
import { subscribeToAppBecameActive } from '../native-bridge/AppLifecycleBridge';
import {
  subscribeToChargingStateChanges,
  enableBatteryMonitoring,
  disableBatteryMonitoring,
} from '../native-bridge/BatteryBridge';
import { subscribeToRegionEntered } from '../native-bridge/LocationBridge';
import { checkForAppOpenedEvents } from '../native-bridge/ScreenTimeBridge';
import { SystemEventType, ReminderStatus } from '../domain';

export function useNativeEvents() {
  const handleEvent = useReminderStore((state) => state.handleEvent);
  const reminders = useReminderStore((state) => state.reminders);
  const loadFromStorage = useReminderStore((state) => state.loadFromStorage);
  const lastProcessedEventRef = useRef<string | null>(null);

  // Load reminders from database on mount
  useEffect(() => {
    console.log('[useNativeEvents] Loading reminders from database...');
    loadFromStorage().then(() => {
      console.log('[useNativeEvents] Database loaded successfully');
    }).catch((error) => {
      console.error('[useNativeEvents] Failed to load database:', error);
    });
  }, []);

  // Re-register geofences on app startup (iOS clears them on app restart)
  useEffect(() => {
    const registerStoredGeofences = async () => {
      const { registerGeofence } = await import('../native-bridge/LocationBridge');
      const { TriggerType, LocationConfig } = await import('../domain');

      // Wait for reminders to load
      if (reminders.length === 0) return;

      console.log('[useNativeEvents] Re-registering geofences for location-based reminders...');

      let registeredCount = 0;
      for (const reminder of reminders) {
        // Only register for active reminders
        if (reminder.status !== 'waiting') continue;

        for (const trigger of reminder.triggers) {
          if (trigger.type === TriggerType.LOCATION_ENTER && trigger.config) {
            const locationConfig = trigger.config as any;

            try {
              await registerGeofence(
                `reminder_${reminder.id}`,
                locationConfig.latitude,
                locationConfig.longitude,
                locationConfig.radius
              );
              registeredCount++;
              console.log(`[useNativeEvents] Registered geofence for: ${reminder.title}`);
            } catch (error) {
              console.error(`[useNativeEvents] Failed to register geofence for ${reminder.title}:`, error);
            }
          }
        }
      }

      if (registeredCount > 0) {
        console.log(`[useNativeEvents] Successfully re-registered ${registeredCount} geofence(s)`);
      }
    };

    registerStoredGeofences();
  }, [reminders.length]); // Run when reminders are loaded

  useEffect(() => {
    console.log('[useNativeEvents] Setting up native event listeners...');
    console.log('[useNativeEvents] Current reminders count:', reminders.length);

    // Enable battery monitoring on app startup
    enableBatteryMonitoring().catch((error) => {
      console.error('[useNativeEvents] Failed to enable battery monitoring:', error);
    });

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

    // Subscribe to charging state changes
    const unsubscribeCharging = subscribeToChargingStateChanges((event) => {
      console.log('=================================================');
      console.log('[useNativeEvents] 🔋 CHARGING_STATE_CHANGED event received!');
      console.log('[useNativeEvents] Event timestamp:', new Date(event.timestamp).toISOString());
      console.log('[useNativeEvents] Is charging:', event.data.isCharging);
      console.log('[useNativeEvents] Active reminders:', reminders.filter(r => r.status === ReminderStatus.WAITING).length);
      console.log('=================================================');

      handleEvent(event).catch((error) => {
        console.error('[useNativeEvents] Error handling charging event:', error);
      });
    });

    // Subscribe to location region entered events
    const unsubscribeLocation = subscribeToRegionEntered((event) => {
      console.log('=================================================');
      console.log('[useNativeEvents] 📍 LOCATION_REGION_ENTERED event received!');
      console.log('[useNativeEvents] Event timestamp:', new Date(event.timestamp).toISOString());
      console.log('[useNativeEvents] Location:', event.data.latitude, event.data.longitude);
      console.log('[useNativeEvents] Identifier:', event.data.identifier);
      console.log('[useNativeEvents] Active reminders:', reminders.filter(r => r.status === ReminderStatus.WAITING).length);
      console.log('=================================================');

      handleEvent(event).catch((error) => {
        console.error('[useNativeEvents] Error handling location event:', error);
      });
    });

    // Poll for app opened events from DeviceActivity extension
    // The extension writes events to App Group storage, which we need to check periodically
    console.log('[useNativeEvents] Setting up APP_OPENED polling interval...');
    let pollCount = 0;
    const pollInterval = setInterval(async () => {
      pollCount++;
      console.log(`[useNativeEvents] 🔍 Polling for app opened events (poll #${pollCount})...`);

      try {
        const rawEvent = await checkForAppOpenedEvents();
        console.log('[useNativeEvents] Poll result:', rawEvent ? 'EVENT FOUND' : 'no event');

        if (rawEvent) {
          // Create a unique identifier for this event to prevent duplicate processing
          const eventId = `${rawEvent.timestamp}-${rawEvent.eventName}`;

          // Skip if we've already processed this event
          if (lastProcessedEventRef.current === eventId) {
            console.log('[useNativeEvents] ⏭️  Skipping duplicate event:', eventId);
            return;
          }

          lastProcessedEventRef.current = eventId;

          console.log('=================================================');
          console.log('[useNativeEvents] 📱 APP_OPENED event detected from polling!');
          console.log('[useNativeEvents] Event timestamp:', new Date(rawEvent.timestamp).toISOString());
          console.log('[useNativeEvents] Event name:', rawEvent.eventName);
          console.log('[useNativeEvents] Activity name:', rawEvent.activityName);
          console.log('[useNativeEvents] Active reminders:', reminders.filter(r => r.status === ReminderStatus.WAITING).length);
          console.log('=================================================');

          // Convert raw event to AppOpenedEvent format
          // The activityName contains the unique reminder identifier (e.g., "reminder_abc123")
          const appOpenedEvent = {
            type: SystemEventType.APP_OPENED,
            timestamp: rawEvent.timestamp,
            data: {
              bundleId: rawEvent.activityName, // Use activityName to match specific reminder
            },
          };

          handleEvent(appOpenedEvent).catch((error) => {
            console.error('[useNativeEvents] Error handling app opened event:', error);
          });
        }
      } catch (error) {
        console.error('[useNativeEvents] ❌ Error polling for app opened events:', error);
        console.error('[useNativeEvents] Error details:', JSON.stringify(error, null, 2));
      }
    }, 3000); // Poll every 3 seconds

    // Cleanup on unmount
    return () => {
      console.log('[useNativeEvents] Cleaning up native event listeners...');
      clearInterval(pollInterval);
      unsubscribeAppLifecycle();
      unsubscribeCharging();
      unsubscribeLocation();

      // Disable battery monitoring to save battery
      disableBatteryMonitoring().catch((error) => {
        console.error('[useNativeEvents] Failed to disable battery monitoring:', error);
      });
    };
  }, [handleEvent, reminders.length]);
}
