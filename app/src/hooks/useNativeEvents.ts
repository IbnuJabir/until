/**
 * Hook to subscribe to native system events
 * Connects native modules to the Zustand store
 */

import { useEffect, useRef } from 'react';
import { NativeModules } from 'react-native';
import { useReminderStore } from '../store/reminderStore';
import { subscribeToAppBecameActive } from '../native-bridge/AppLifecycleBridge';
import {
  subscribeToChargingStateChanges,
  enableBatteryMonitoring,
  disableBatteryMonitoring,
} from '../native-bridge/BatteryBridge';
import { subscribeToRegionEntered } from '../native-bridge/LocationBridge';
import { checkForAppOpenedEvents } from '../native-bridge/ScreenTimeBridge';
import { SystemEventType, ReminderStatus, TriggerType, LocationConfig } from '../domain';

export function useNativeEvents() {
  const handleEvent = useReminderStore((state) => state.handleEvent);
  const reminders = useReminderStore((state) => state.reminders);
  const isLoading = useReminderStore((state) => state.isLoading);
  const loadFromStorage = useReminderStore((state) => state.loadFromStorage);
  const lastProcessedEventRef = useRef<string | null>(null);
  const listenersSetupRef = useRef(false); // Track if listeners are already set up
  const dbLoadedRef = useRef(false); // Track if database load has completed

  // Load reminders from database on mount - MUST complete before event listeners start
  useEffect(() => {
    console.log('[useNativeEvents] Loading reminders from database...');
    loadFromStorage()
      .then(() => {
        dbLoadedRef.current = true;
        console.log('[useNativeEvents] ✅ Database loaded successfully');
      })
      .catch((error) => {
        dbLoadedRef.current = true; // Mark as done even on error to prevent hanging
        console.error('[useNativeEvents] ❌ Failed to load database:', error);
      });
  }, [loadFromStorage]);

  // Re-register geofences on app startup (iOS clears them on app restart)
  useEffect(() => {
    const registerStoredGeofences = async () => {
      // Wait for reminders to load
      if (reminders.length === 0) return;

      // Check if we have any location-based reminders before importing
      const hasLocationReminders = reminders.some(r =>
        r.status === 'waiting' &&
        r.triggers.some(t => t.type === TriggerType.LOCATION_ENTER)
      );

      if (!hasLocationReminders) {
        console.log('[useNativeEvents] No active location-based reminders to register');
        return;
      }

      try {
        // Check if LocationModule is available
        if (!NativeModules.LocationModule) {
          console.warn('[useNativeEvents] LocationModule not available - skipping geofence registration. Make sure iOS project is built.');
          return;
        }

        const { registerGeofence } = await import('../native-bridge/LocationBridge');

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
      } catch (error) {
        console.error('[useNativeEvents] Error during geofence registration:', error);
      }
    };

    registerStoredGeofences();
  }, [reminders.length]); // Run when reminders are loaded

  useEffect(() => {
    // Only set up listeners ONCE and ONLY after database is fully loaded
    if (!dbLoadedRef.current) {
      console.log('[useNativeEvents] ⏳ Waiting for database to load... (will retry)');
      return;
    }

    if (listenersSetupRef.current) {
      console.log('[useNativeEvents] Listeners already set up, skipping...');
      return;
    }

    listenersSetupRef.current = true;

    console.log('[useNativeEvents] ✅ Database loaded. Setting up native event listeners...');
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
    console.log('[useNativeEvents] ℹ️ NOTE: DeviceActivity extension logs appear in system Console.app, not Metro');
    console.log('[useNativeEvents] ℹ️ To view extension logs:');
    console.log('[useNativeEvents] ℹ️   1. Open Console.app on Mac');
    console.log('[useNativeEvents] ℹ️   2. Filter by "DeviceActivityMonitor"');
    console.log('[useNativeEvents] ℹ️   3. Watch for 🔥 EVENT THRESHOLD REACHED messages');

    let pollCount = 0;
    const pollInterval = setInterval(async () => {
      pollCount++;
      console.log(`[useNativeEvents] 🔍 Polling for app opened events (poll #${pollCount})...`);

      try {
        const rawEvent = await checkForAppOpenedEvents();
        console.log('[useNativeEvents] Poll result:', rawEvent ? 'EVENT FOUND ✅' : 'no event');

        // Log App Group status every 10 polls (30 seconds)
        if (pollCount % 10 === 0) {
          console.log('[useNativeEvents] ℹ️ App Group status check:');
          console.log(`[useNativeEvents]   - Polls completed: ${pollCount}`);
          console.log(`[useNativeEvents]   - Events found: ${pollCount - (pollCount - (lastProcessedEventRef.current ? 1 : 0))}`);
          console.log('[useNativeEvents]   - App Group ID: group.com.ibnuj.until');
          console.log('[useNativeEvents]   - If no events after app usage, check Console.app for extension logs');
        }

        if (rawEvent) {
          console.log('=================================================');
          console.log('[useNativeEvents] 📱 RAW APP_OPENED EVENT DETECTED');
          console.log('[useNativeEvents] Raw event data:', JSON.stringify(rawEvent, null, 2));
          console.log('[useNativeEvents] Event timestamp:', new Date(rawEvent.timestamp).toISOString());
          console.log('[useNativeEvents] App ID (precise identifier):', rawEvent.appId);
          console.log('[useNativeEvents] Activity name (global monitor):', rawEvent.activityName);
          console.log('=================================================');

          // Validate event has required fields
          if (!rawEvent.appId) {
            console.error('[useNativeEvents] ❌ ERROR: Event missing appId!');
            console.error('[useNativeEvents] This event cannot be matched to reminders');
            return;
          }

          // Create a unique identifier for this event to prevent duplicate processing
          const eventId = `${rawEvent.appId}-${rawEvent.timestamp}`;

          // Skip if we've already processed this event
          if (lastProcessedEventRef.current === eventId) {
            console.log('[useNativeEvents] ⏭️  Skipping duplicate event:', eventId);
            return;
          }

          lastProcessedEventRef.current = eventId;

          // Check if any waiting reminders have this appId
          const matchingReminders = reminders.filter(r => {
            if (r.status !== ReminderStatus.WAITING) return false;
            const appTrigger = r.triggers.find(t => t.type === TriggerType.APP_OPENED);
            if (!appTrigger) return false;
            const config = appTrigger.config as { appId?: string } | undefined;
            return config?.appId === rawEvent.appId;
          });

          console.log('[useNativeEvents] 🔍 Validation:');
          console.log('[useNativeEvents]   Total reminders:', reminders.length);
          console.log('[useNativeEvents]   Waiting reminders:', reminders.filter(r => r.status === ReminderStatus.WAITING).length);
          console.log('[useNativeEvents]   Matching reminders for appId:', matchingReminders.length);

          if (matchingReminders.length > 0) {
            matchingReminders.forEach(r => {
              console.log(`[useNativeEvents]   ✅ Found matching reminder: "${r.title}" (id: ${r.id})`);
            });
          } else {
            console.warn('[useNativeEvents]   ⚠️ WARNING: No waiting reminders match this appId!');
            console.warn('[useNativeEvents]   AppId from event:', rawEvent.appId);
          }

          // Convert raw event to AppOpenedEvent format
          // The appId contains the precise app identifier (e.g., "app_instagram")
          const appOpenedEvent = {
            type: SystemEventType.APP_OPENED,
            timestamp: rawEvent.timestamp,
            data: {
              appId: rawEvent.appId, // Precise app identifier for matching
            },
          };

          console.log('[useNativeEvents] 📤 Dispatching event to handleEvent with appId:', appOpenedEvent.data.appId);
          console.log('=================================================');

          handleEvent(appOpenedEvent).catch((error) => {
            console.error('[useNativeEvents] ❌ Error handling app opened event:', error);
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
  }, [handleEvent]); // Only depend on handleEvent - dbLoadedRef is checked inside effect
}
