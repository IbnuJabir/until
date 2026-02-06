/**
 * Zustand Store for Reminder State Management
 * Follows CONTEXT.md Phase 2 - NO state mutation in UI layer
 */

import { create } from 'zustand';
import {
  Reminder,
  ReminderStatus,
  PaymentEntitlement,
  SystemEvent,
  SystemEventType,
  SavedPlace,
  TriggerType,
  AppOpenedEvent,
  createReminder,
  markReminderAsFired,
  isReminderActive,
} from '../domain';
import { handleSystemEvent } from '../engine/RuleEngine';

/**
 * Global event processing lock to prevent race conditions
 * Tracks which reminders are currently being processed to avoid firing the same reminder twice
 */
const processingReminders = new Set<string>();

/**
 * System state (battery, location, etc.)
 */
export interface SystemState {
  isCharging: boolean;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  lastAppOpened?: string;
}

/**
 * Store State
 */
interface ReminderStore {
  // Reminder data
  reminders: Reminder[];
  systemState: SystemState;

  // Saved places
  savedPlaces: SavedPlace[];

  // Payment entitlements
  entitlements: PaymentEntitlement;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  addReminder: (reminder: Reminder) => Promise<void>;
  updateReminder: (id: string, updates: Partial<Reminder>) => Promise<void>;
  updateReminderStatus: (id: string, status: ReminderStatus) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  deleteMultipleReminders: (ids: string[]) => Promise<void>;
  fireReminder: (id: string) => Promise<void>;

  // Saved place actions
  addSavedPlace: (place: SavedPlace) => Promise<void>;
  updateSavedPlace: (id: string, updates: Partial<SavedPlace>) => Promise<void>;
  deleteSavedPlace: (id: string) => Promise<void>;
  getSavedPlaceById: (id: string) => SavedPlace | undefined;
  incrementPlaceUsage: (id: string) => Promise<void>;

  // System event handler
  handleEvent: (event: SystemEvent) => Promise<void>;

  // System state updates
  updateSystemState: (state: Partial<SystemState>) => void;

  // Payment actions
  updateEntitlements: (entitlements: PaymentEntitlement) => void;

  // Query helpers
  getActiveReminders: () => Reminder[];
  getReminderById: (id: string) => Reminder | undefined;
  canAddMoreReminders: () => boolean;

  // Persistence
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
}

/**
 * Default system state
 */
const defaultSystemState: SystemState = {
  isCharging: false,
  currentLocation: undefined,
  lastAppOpened: undefined,
};

/**
 * Default payment entitlements (free tier)
 */
const defaultEntitlements: PaymentEntitlement = {
  hasProAccess: false,
  subscriptionActive: false,
};

/**
 * Zustand store
 */
export const useReminderStore = create<ReminderStore>((set, get) => ({
  // Initial state
  reminders: [],
  savedPlaces: [],
  systemState: defaultSystemState,
  entitlements: defaultEntitlements,
  isLoading: false,
  error: null,

  /**
   * Add a new reminder
   */
  addReminder: async (reminder: Reminder) => {
    set({ isLoading: true, error: null });

    try {
      const currentReminders = get().reminders;

      // Check if user can add more reminders (free tier limit)
      if (!get().canAddMoreReminders()) {
        throw new Error('Free tier limit reached. Upgrade to add more reminders.');
      }

      // Register geofences for location triggers
      for (const trigger of reminder.triggers) {
        if (trigger.type === 'LOCATION_ENTER' && trigger.config) {
          const { registerGeofence } = await import('../native-bridge/LocationBridge');
          const locationConfig = trigger.config as {
            latitude: number;
            longitude: number;
            radius: number;
            name?: string;
          };

          try {
            await registerGeofence(
              `reminder_${reminder.id}`,
              locationConfig.latitude,
              locationConfig.longitude,
              locationConfig.radius
            );
            console.log(`[Store] Registered geofence for reminder: ${reminder.title}`);
          } catch (error) {
            console.error('[Store] Failed to register geofence:', error);
            // Don't fail the whole operation, just log the error
          }
        }
      }

      // Schedule notifications for SCHEDULED_TIME triggers
      for (const trigger of reminder.triggers) {
        if (trigger.type === 'SCHEDULED_TIME' && trigger.config) {
          const { scheduleNotificationAtTime } = await import('../utils/NotificationService');
          const scheduledConfig = trigger.config as {
            scheduledDateTime: number;
          };

          try {
            const notificationId = await scheduleNotificationAtTime(
              reminder,
              scheduledConfig.scheduledDateTime
            );

            // Store notification ID for later cancellation
            reminder.notificationId = notificationId;

            console.log(`[Store] Scheduled notification for reminder: ${reminder.title} at ${new Date(scheduledConfig.scheduledDateTime).toLocaleString()}`);
          } catch (error) {
            console.error('[Store] Failed to schedule notification:', error);
            // Don't fail the whole operation, just log the error
          }
        }
      }

      set({
        reminders: [...currentReminders, reminder],
        isLoading: false,
      });

      await get().saveToStorage();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add reminder',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Update an existing reminder
   */
  updateReminder: async (id: string, updates: Partial<Reminder>) => {
    set({ isLoading: true, error: null });

    try {
      const currentReminders = get().reminders;
      const updatedReminders = currentReminders.map((reminder) =>
        reminder.id === id ? { ...reminder, ...updates } : reminder
      );

      set({
        reminders: updatedReminders,
        isLoading: false,
      });

      await get().saveToStorage();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update reminder',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Update reminder status
   */
  updateReminderStatus: async (id: string, status: ReminderStatus) => {
    const reminder = get().getReminderById(id);

    // If reactivating a reminder (setting status to WAITING), restart monitoring for APP_OPENED triggers
    if (status === ReminderStatus.WAITING && reminder) {
      for (const trigger of reminder.triggers) {
        if (trigger.type === 'APP_OPENED' && trigger.config) {
          const { startMonitoring } = await import('../native-bridge/ScreenTimeBridge');
          const config = trigger.config as { activityName?: string; bundleId?: string; appName: string };

          if (config.activityName) {
            try {
              const result = await startMonitoring(config.activityName);
              if (result.success) {
                console.log(`[Store] Restarted monitoring for reactivated reminder: ${reminder.title}`);
              } else {
                console.warn(`[Store] Failed to restart monitoring for: ${reminder.title}`);
              }
            } catch (error) {
              console.error(`[Store] Error restarting monitoring for ${reminder.title}:`, error);
              // Don't fail the reactivation, just log the error
            }
          }
        }
      }
    }

    await get().updateReminder(id, { status });
  },

  /**
   * Delete a reminder
   */
  deleteReminder: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const { deleteReminder: dbDeleteReminder } = await import(
        '../storage/database'
      );

      const currentReminders = get().reminders;
      const reminder = currentReminders.find((r) => r.id === id);
      const filteredReminders = currentReminders.filter((r) => r.id !== id);

      // Unregister geofences for location triggers and cancel scheduled notifications
      if (reminder) {
        for (const trigger of reminder.triggers) {
          if (trigger.type === 'LOCATION_ENTER') {
            const { unregisterGeofence } = await import('../native-bridge/LocationBridge');

            try {
              await unregisterGeofence(`reminder_${id}`);
              console.log(`[Store] Unregistered geofence for reminder: ${reminder.title}`);
            } catch (error) {
              console.warn('[Store] Failed to unregister geofence:', error);
              // Don't fail the whole operation, just log the warning
            }
          }
        }

        // Cancel scheduled notifications for SCHEDULED_TIME triggers
        if (reminder.notificationId) {
          const Notifications = await import('expo-notifications');

          try {
            await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
            console.log(`[Store] Cancelled scheduled notification for reminder: ${reminder.title}`);
          } catch (error) {
            console.warn('[Store] Failed to cancel scheduled notification:', error);
            // Don't fail the whole operation, just log the warning
          }
        }
      }

      // Delete from database
      await dbDeleteReminder(id);

      set({
        reminders: filteredReminders,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete reminder',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Delete multiple reminders at once (batch delete)
   */
  deleteMultipleReminders: async (ids: string[]) => {
    set({ isLoading: true, error: null });

    try {
      const { deleteReminder: dbDeleteReminder } = await import(
        '../storage/database'
      );

      const currentReminders = get().reminders;
      const remindersToDelete = currentReminders.filter((r) => ids.includes(r.id));
      const remainingReminders = currentReminders.filter((r) => !ids.includes(r.id));

      // Cleanup for each reminder
      for (const reminder of remindersToDelete) {
        // Unregister geofences for location triggers
        for (const trigger of reminder.triggers) {
          if (trigger.type === 'LOCATION_ENTER') {
            const { unregisterGeofence } = await import('../native-bridge/LocationBridge');

            try {
              await unregisterGeofence(`reminder_${reminder.id}`);
              console.log(`[Store] Unregistered geofence for reminder: ${reminder.title}`);
            } catch (error) {
              console.warn('[Store] Failed to unregister geofence:', error);
            }
          }
        }

        // Cancel scheduled notifications
        if (reminder.notificationId) {
          const Notifications = await import('expo-notifications');

          try {
            await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
            console.log(`[Store] Cancelled scheduled notification for reminder: ${reminder.title}`);
          } catch (error) {
            console.warn('[Store] Failed to cancel scheduled notification:', error);
          }
        }

        // Delete from database
        await dbDeleteReminder(reminder.id);
      }

      set({
        reminders: remainingReminders,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete reminders',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Mark a reminder as fired
   */
  fireReminder: async (id: string) => {
    const reminder = get().getReminderById(id);
    if (!reminder) {
      return;
    }

    const firedReminder = markReminderAsFired(reminder);
    await get().updateReminder(id, firedReminder);
  },

  /**
   * Handle system events (core rule engine integration)
   */
  handleEvent: async (event: SystemEvent) => {
    const { reminders, systemState } = get();

    console.log('=================================================');
    console.log('[Store] 📥 handleEvent called');
    console.log('[Store] Event type:', event.type);
    console.log('[Store] Event timestamp:', new Date(event.timestamp).toISOString());
    console.log('[Store] Total reminders in store:', reminders.length);
    console.log('[Store] Reminders by status:', {
      waiting: reminders.filter(r => r.status === ReminderStatus.WAITING).length,
      fired: reminders.filter(r => r.status === ReminderStatus.FIRED).length,
      expired: reminders.filter(r => r.status === ReminderStatus.EXPIRED).length,
    });

    // For APP_BECAME_ACTIVE (Phone Unlock) events, show extra details
    if (event.type === SystemEventType.APP_BECAME_ACTIVE) {
      console.log('[Store] 🔔 APP_BECAME_ACTIVE (Phone Unlock) event details:');

      // Show which reminders have PHONE_UNLOCK triggers
      const phoneUnlockReminders = reminders.filter(r =>
        r.triggers.some(t => t.type === TriggerType.PHONE_UNLOCK)
      );
      console.log('[Store]   Reminders with PHONE_UNLOCK triggers:', phoneUnlockReminders.length);
      phoneUnlockReminders.forEach(r => {
        console.log(`[Store]     - "${r.title}" (id: ${r.id}, status: ${r.status})`);

        // Check activation time for each trigger
        const phoneUnlockTrigger = r.triggers.find(t => t.type === TriggerType.PHONE_UNLOCK);
        if (phoneUnlockTrigger?.activationDateTime) {
          const now = Date.now();
          const activationTime = phoneUnlockTrigger.activationDateTime;
          const isActive = now >= activationTime;
          console.log(`[Store]       Activation time: ${new Date(activationTime).toLocaleString()}`);
          console.log(`[Store]       Current time: ${new Date(now).toLocaleString()}`);
          console.log(`[Store]       Is active: ${isActive ? '✅ YES' : '❌ NOT YET (will not fire)'}`);
        }
      });
    }

    // For APP_OPENED events, show extra details
    if (event.type === SystemEventType.APP_OPENED) {
      const appEvent = event as AppOpenedEvent;
      console.log('[Store] APP_OPENED event details:');
      console.log('[Store]   bundleId (activityName):', appEvent.data.bundleId);

      // Show which reminders have APP_OPENED triggers
      const appOpenedReminders = reminders.filter(r =>
        r.triggers.some(t => t.type === TriggerType.APP_OPENED)
      );
      console.log('[Store]   Reminders with APP_OPENED triggers:', appOpenedReminders.length);
      appOpenedReminders.forEach(r => {
        const appTrigger = r.triggers.find(t => t.type === TriggerType.APP_OPENED);
        const config = appTrigger?.config as { activityName?: string } | undefined;
        console.log(`[Store]     - "${r.title}" (status: ${r.status}, activityName: ${config?.activityName || 'NOT SET'})`);
      });
    }

    // For CHARGING_STATE_CHANGED events, show extra details
    if (event.type === SystemEventType.CHARGING_STATE_CHANGED) {
      const chargingEvent = event as any;
      console.log('[Store] 🔋 CHARGING_STATE_CHANGED event details:');
      console.log('[Store]   Is charging:', chargingEvent.data.isCharging);
      console.log('[Store]   Battery level:', chargingEvent.data.level);
      console.log('[Store]   State:', chargingEvent.data.state);

      // Show which reminders have CHARGING triggers
      const chargingReminders = reminders.filter(r =>
        r.triggers.some(t => t.type === TriggerType.CHARGING_STARTED)
      );
      console.log('[Store]   Reminders with CHARGING_STARTED triggers:', chargingReminders.length);
      chargingReminders.forEach(r => {
        console.log(`[Store]     - "${r.title}" (id: ${r.id}, status: ${r.status})`);

        // Check activation time for each trigger
        const chargingTrigger = r.triggers.find(t => t.type === TriggerType.CHARGING_STARTED);
        if (chargingTrigger?.activationDateTime) {
          const now = Date.now();
          const activationTime = chargingTrigger.activationDateTime;
          const isActive = now >= activationTime;
          console.log(`[Store]       Activation time: ${new Date(activationTime).toLocaleString()}`);
          console.log(`[Store]       Current time: ${new Date(now).toLocaleString()}`);
          console.log(`[Store]       Is active: ${isActive ? '✅ YES' : '❌ NOT YET (will not fire)'}`);
        } else {
          console.log(`[Store]       No activation time set - will fire immediately`);
        }
      });
    }
    console.log('=================================================');

    // Fire notification handler with race condition protection
    const fireNotification = async (reminder: Reminder) => {
      // Check if this reminder is already being processed (prevent double-fire race condition)
      if (processingReminders.has(reminder.id)) {
        console.warn(`[Store] ⚠️ Reminder ${reminder.id} is already being processed, skipping to prevent duplicate fire`);
        return;
      }

      processingReminders.add(reminder.id);

      const { fireNotification: fireNotificationService } = await import(
        '../utils/NotificationService'
      );

      try {
        console.log(`[Store] 🔔 Calling notification service for: ${reminder.title}`);
        await fireNotificationService(reminder);
        console.log(`[Store] ✅ Notification fired successfully for: ${reminder.title}`);
      } catch (error) {
        console.error(`[Store] ❌ Failed to fire notification:`, error);
        throw error;
      } finally {
        // Remove from processing set after completion (success or failure)
        processingReminders.delete(reminder.id);
      }
    };

    // State update handler
    const updateReminderState = async (reminder: Reminder) => {
      console.log(`[Store] 💾 Updating reminder state for: ${reminder.title}`);
      console.log(`[Store]   Old status: ${reminder.status}`);
      await get().updateReminder(reminder.id, reminder);
      console.log(`[Store] ✅ Reminder state updated`);
    };

    // Execute rule engine
    console.log('[Store] 🚀 Calling rule engine (handleSystemEvent)...');
    await handleSystemEvent(
      event,
      reminders,
      systemState,
      fireNotification,
      updateReminderState
    );
    console.log('[Store] ✅ Rule engine execution complete');
  },

  /**
   * Update system state (battery, location, etc.)
   */
  updateSystemState: (state: Partial<SystemState>) => {
    set((prevState) => ({
      systemState: { ...prevState.systemState, ...state },
    }));
  },

  /**
   * Update payment entitlements
   */
  updateEntitlements: (entitlements: PaymentEntitlement) => {
    set({ entitlements });
    // Save to secure storage (Keychain)
    // TODO: Implement in Phase 8
  },

  /**
   * Get all active (waiting) reminders
   */
  getActiveReminders: () => {
    return get().reminders.filter(isReminderActive);
  },

  /**
   * Get reminder by ID
   */
  getReminderById: (id: string) => {
    return get().reminders.find((r) => r.id === id);
  },

  /**
   * Add a new saved place
   */
  addSavedPlace: async (place: SavedPlace) => {
    set({ isLoading: true, error: null });

    try {
      const { saveSavedPlace } = await import('../storage/database');

      const currentPlaces = get().savedPlaces;

      // Save to database
      await saveSavedPlace(place);

      set({
        savedPlaces: [...currentPlaces, place],
        isLoading: false,
      });

      console.log(`[Store] Added saved place: ${place.name}`);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to add saved place',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Update an existing saved place
   */
  updateSavedPlace: async (id: string, updates: Partial<SavedPlace>) => {
    set({ isLoading: true, error: null });

    try {
      const { updateSavedPlace: dbUpdateSavedPlace } = await import(
        '../storage/database'
      );

      const currentPlaces = get().savedPlaces;
      const updatedPlaces = currentPlaces.map((place) =>
        place.id === id ? { ...place, ...updates } : place
      );

      // Update in database
      await dbUpdateSavedPlace(id, updates);

      set({
        savedPlaces: updatedPlaces,
        isLoading: false,
      });

      console.log(`[Store] Updated saved place: ${id}`);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update saved place',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Delete a saved place
   */
  deleteSavedPlace: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const { deleteSavedPlace: dbDeleteSavedPlace } = await import(
        '../storage/database'
      );

      const currentPlaces = get().savedPlaces;
      const filteredPlaces = currentPlaces.filter((p) => p.id !== id);

      // Delete from database
      await dbDeleteSavedPlace(id);

      set({
        savedPlaces: filteredPlaces,
        isLoading: false,
      });

      console.log(`[Store] Deleted saved place: ${id}`);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete saved place',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Get saved place by ID
   */
  getSavedPlaceById: (id: string) => {
    return get().savedPlaces.find((p) => p.id === id);
  },

  /**
   * Increment usage count for a saved place
   */
  incrementPlaceUsage: async (id: string) => {
    try {
      const { incrementPlaceUsage: dbIncrementPlaceUsage } = await import(
        '../storage/database'
      );

      const currentPlaces = get().savedPlaces;
      const updatedPlaces = currentPlaces.map((place) =>
        place.id === id
          ? {
              ...place,
              usageCount: place.usageCount + 1,
              lastUsedAt: Date.now(),
            }
          : place
      );

      // Update in database
      await dbIncrementPlaceUsage(id);

      set({
        savedPlaces: updatedPlaces,
      });

      console.log(`[Store] Incremented usage for saved place: ${id}`);
    } catch (error) {
      console.error('[Store] Failed to increment place usage:', error);
      // Don't throw - this is a non-critical operation
    }
  },

  /**
   * Check if user can add more reminders (free tier limit)
   */
  canAddMoreReminders: () => {
    // TEMP: Disabled for testing - allow unlimited reminders
    return true;

    // ORIGINAL CODE (commented out for testing):
    // const { reminders, entitlements } = get();
    //
    // // Pro users have unlimited reminders
    // if (entitlements.hasProAccess) {
    //   return true;
    // }
    //
    // // Free users limited to 3 active reminders
    // const activeReminders = reminders.filter(isReminderActive);
    // return activeReminders.length < 3;
  },

  /**
   * Load reminders from persistent storage
   */
  loadFromStorage: async () => {
    set({ isLoading: true, error: null });

    try {
      const { loadAllReminders, loadEntitlements, loadAllSavedPlaces, initDatabase } = await import(
        '../storage/database'
      );

      // Initialize database schema
      await initDatabase();

      // Load reminders
      const reminders = await loadAllReminders();

      // Load saved places
      const savedPlaces = await loadAllSavedPlaces();

      // Load payment entitlements
      const entitlements = await loadEntitlements();

      set({
        reminders,
        savedPlaces,
        entitlements,
        isLoading: false,
      });

      console.log(`[Store] Loaded ${reminders.length} reminders and ${savedPlaces.length} saved places from storage`);

      // Log activation time for each loaded reminder to verify database persistence
      reminders.forEach(reminder => {
        console.log(`[Store] 📋 Loaded reminder: "${reminder.title}"`);
        reminder.triggers.forEach((trigger, index) => {
          console.log(`[Store]   Trigger ${index + 1}:`);
          console.log(`[Store]     type: ${trigger.type}`);
          console.log(`[Store]     activationDateTime (raw): ${trigger.activationDateTime}`);
          console.log(`[Store]     activationDateTime (readable): ${trigger.activationDateTime ? new Date(trigger.activationDateTime).toLocaleString() : 'NOT SET'}`);
        });
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load data',
        isLoading: false,
      });
      console.error('[Store] Load error:', error);
    }
  },

  /**
   * Save reminders to persistent storage
   */
  saveToStorage: async () => {
    try {
      const { saveReminder, saveEntitlements } = await import(
        '../storage/database'
      );

      const { reminders, entitlements } = get();

      // Save all reminders
      for (const reminder of reminders) {
        await saveReminder(reminder);
      }

      // Save entitlements
      await saveEntitlements(entitlements);

      console.log('[Store] Saved to storage successfully');
    } catch (error) {
      console.error('[Store] Failed to save:', error);
      throw error;
    }
  },
}));
