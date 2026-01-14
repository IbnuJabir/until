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
  createReminder,
  markReminderAsFired,
  isReminderActive,
} from '../domain';
import { handleSystemEvent } from '../engine/RuleEngine';

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
  fireReminder: (id: string) => Promise<void>;

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
      const filteredReminders = currentReminders.filter((r) => r.id !== id);

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

    console.log('[Store] handleEvent called');
    console.log('[Store] Event:', event.type);
    console.log('[Store] Reminders in store:', reminders.length);

    // Fire notification handler
    const fireNotification = async (reminder: Reminder) => {
      const { fireNotification: fireNotificationService } = await import(
        '../utils/NotificationService'
      );

      try {
        console.log(`[Store] Calling notification service for: ${reminder.title}`);
        await fireNotificationService(reminder);
        console.log(`[Store] ✅ Notification fired successfully for: ${reminder.title}`);
      } catch (error) {
        console.error(`[Store] ❌ Failed to fire notification:`, error);
        throw error;
      }
    };

    // State update handler
    const updateReminderState = async (reminder: Reminder) => {
      console.log(`[Store] Updating reminder state for: ${reminder.title}`);
      await get().updateReminder(reminder.id, reminder);
      console.log(`[Store] ✅ Reminder state updated`);
    };

    // Execute rule engine
    await handleSystemEvent(
      event,
      reminders,
      systemState,
      fireNotification,
      updateReminderState
    );
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
      const { loadAllReminders, loadEntitlements, initDatabase } = await import(
        '../storage/database'
      );

      // Initialize database schema
      await initDatabase();

      // Load reminders
      const reminders = await loadAllReminders();

      // Load payment entitlements
      const entitlements = await loadEntitlements();

      set({
        reminders,
        entitlements,
        isLoading: false,
      });

      console.log(`[Store] Loaded ${reminders.length} reminders from storage`);
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
