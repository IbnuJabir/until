/**
 * Rule Engine - Core event-driven reminder evaluation system
 * Follows CONTEXT.md Phase 2 specification
 *
 * Responsibilities:
 * - Register reminders by trigger type
 * - Evaluate rules ONLY when events occur (never poll)
 * - Fire notifications once per reminder
 * - Persist state changes
 */

import {
  Reminder,
  SystemEvent,
  SystemEventType,
  TriggerType,
  ConditionType,
  ReminderStatus,
  TimeRangeConditionConfig,
  DayOfWeekConditionConfig,
  LocationConditionConfig,
  ChargingEvent,
  LocationEvent,
  AppOpenedEvent,
} from '../domain';

/**
 * Rule evaluation context - current system state when event fires
 */
export interface EvaluationContext {
  currentTime: Date;
  isCharging: boolean;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  lastOpenedApp?: string;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Check if current time is within a time range
 */
function isTimeInRange(
  currentTime: Date,
  startHour: number,
  endHour: number
): boolean {
  const currentHour = currentTime.getHours();

  // Handle overnight ranges (e.g., 22:00 to 06:00)
  if (startHour > endHour) {
    return currentHour >= startHour || currentHour <= endHour;
  }

  return currentHour >= startHour && currentHour <= endHour;
}

/**
 * Evaluate a single condition
 */
export function evaluateCondition(
  condition: Reminder['conditions'][0],
  context: EvaluationContext
): boolean {
  switch (condition.type) {
    case ConditionType.TIME_RANGE: {
      const config = condition.config as TimeRangeConditionConfig;
      return isTimeInRange(context.currentTime, config.startHour, config.endHour);
    }

    case ConditionType.DAY_OF_WEEK: {
      const config = condition.config as DayOfWeekConditionConfig;
      const currentDay = context.currentTime.getDay();
      return config.days.includes(currentDay);
    }

    case ConditionType.IS_CHARGING: {
      const requiredChargingState = condition.config as boolean;
      return context.isCharging === requiredChargingState;
    }

    case ConditionType.AT_LOCATION: {
      const config = condition.config as LocationConditionConfig;
      if (!context.currentLocation) {
        return false;
      }

      const distance = calculateDistance(
        context.currentLocation.latitude,
        context.currentLocation.longitude,
        config.latitude,
        config.longitude
      );

      return distance <= config.radius;
    }

    default:
      return false;
  }
}

/**
 * Evaluate ALL conditions for a reminder (AND logic only)
 */
export function evaluateAllConditions(
  reminder: Reminder,
  context: EvaluationContext
): boolean {
  // If no conditions, default to true
  if (!reminder.conditions || reminder.conditions.length === 0) {
    return true;
  }

  // ALL conditions must be true (AND logic)
  return reminder.conditions.every((condition) =>
    evaluateCondition(condition, context)
  );
}

/**
 * Check if a reminder's trigger matches the current event
 */
export function doesTriggerMatchEvent(
  reminder: Reminder,
  event: SystemEvent
): boolean {
  return reminder.triggers.some((trigger) => {
    switch (event.type) {
      case SystemEventType.APP_BECAME_ACTIVE:
        return trigger.type === TriggerType.PHONE_UNLOCK;

      case SystemEventType.CHARGING_STATE_CHANGED: {
        const chargingEvent = event as ChargingEvent;
        return (
          trigger.type === TriggerType.CHARGING_STARTED &&
          chargingEvent.data.isCharging
        );
      }

      case SystemEventType.LOCATION_REGION_ENTERED:
        return trigger.type === TriggerType.LOCATION_ENTER;

      case SystemEventType.APP_OPENED: {
        const appEvent = event as AppOpenedEvent;
        if (trigger.type !== TriggerType.APP_OPENED) {
          return false;
        }
        // Check if bundleId matches
        const config = trigger.config as { bundleId: string };
        return config?.bundleId === appEvent.data.bundleId;
      }

      default:
        return false;
    }
  });
}

/**
 * Filter reminders that are listening to a specific event type
 */
export function getRemindersListeningTo(
  reminders: Reminder[],
  event: SystemEvent
): Reminder[] {
  return reminders.filter(
    (reminder) =>
      reminder.status === ReminderStatus.WAITING &&
      doesTriggerMatchEvent(reminder, event)
  );
}

/**
 * Build evaluation context from current system state
 */
export function buildEvaluationContext(
  event: SystemEvent,
  currentState: {
    isCharging: boolean;
    currentLocation?: { latitude: number; longitude: number };
  }
): EvaluationContext {
  const context: EvaluationContext = {
    currentTime: new Date(event.timestamp),
    isCharging: currentState.isCharging,
    currentLocation: currentState.currentLocation,
  };

  // Extract event-specific data
  switch (event.type) {
    case SystemEventType.CHARGING_STATE_CHANGED:
      context.isCharging = (event as ChargingEvent).data.isCharging;
      break;

    case SystemEventType.LOCATION_REGION_ENTERED:
      const locationEvent = event as LocationEvent;
      context.currentLocation = {
        latitude: locationEvent.data.latitude,
        longitude: locationEvent.data.longitude,
      };
      break;

    case SystemEventType.APP_OPENED:
      context.lastOpenedApp = (event as AppOpenedEvent).data.bundleId;
      break;
  }

  return context;
}

/**
 * Core rule evaluation logic
 * Called when ANY system event occurs
 */
export interface RuleEvaluationResult {
  remindersToFire: Reminder[];
  evaluatedCount: number;
}

export function evaluateRules(
  allReminders: Reminder[],
  event: SystemEvent,
  currentState: {
    isCharging: boolean;
    currentLocation?: { latitude: number; longitude: number };
  }
): RuleEvaluationResult {
  console.log('[RuleEngine] ========== Evaluating Rules ==========');
  console.log('[RuleEngine] Event type:', event.type);
  console.log('[RuleEngine] Total reminders:', allReminders.length);
  console.log('[RuleEngine] Reminders by status:', {
    waiting: allReminders.filter(r => r.status === ReminderStatus.WAITING).length,
    fired: allReminders.filter(r => r.status === ReminderStatus.FIRED).length,
  });

  // Step 1: Filter reminders listening to this event
  const listeningReminders = getRemindersListeningTo(allReminders, event);
  console.log('[RuleEngine] Reminders listening to this event:', listeningReminders.length);

  if (listeningReminders.length > 0) {
    listeningReminders.forEach(r => {
      console.log(`[RuleEngine] - "${r.title}" (${r.triggers.length} triggers, ${r.conditions.length} conditions)`);
    });
  }

  // Step 2: Build evaluation context
  const context = buildEvaluationContext(event, currentState);
  console.log('[RuleEngine] Evaluation context:', {
    time: context.currentTime.toISOString(),
    isCharging: context.isCharging,
    hasLocation: !!context.currentLocation,
  });

  // Step 3: Evaluate conditions for each reminder
  const remindersToFire = listeningReminders.filter((reminder) => {
    const shouldFire = evaluateAllConditions(reminder, context);
    console.log(`[RuleEngine] "${reminder.title}" - Should fire: ${shouldFire}`);
    return shouldFire;
  });

  console.log('[RuleEngine] Reminders to fire:', remindersToFire.length);
  console.log('[RuleEngine] ========================================');

  return {
    remindersToFire,
    evaluatedCount: listeningReminders.length,
  };
}

/**
 * Main event handler - this is called by native modules
 * Pseudocode from CONTEXT.md:
 *
 * onEvent(event) {
 *   reminders = getRemindersListeningTo(event.type)
 *   for reminder in reminders:
 *     if allConditionsTrue(reminder):
 *       fireNotification(reminder)
 *       markAsFired(reminder)
 * }
 */
export type NotificationHandler = (reminder: Reminder) => Promise<void>;
export type StateUpdateHandler = (reminder: Reminder) => Promise<void>;

export async function handleSystemEvent(
  event: SystemEvent,
  allReminders: Reminder[],
  currentState: {
    isCharging: boolean;
    currentLocation?: { latitude: number; longitude: number };
  },
  fireNotification: NotificationHandler,
  updateReminderState: StateUpdateHandler
): Promise<void> {
  console.log('[RuleEngine] handleSystemEvent called');

  // Evaluate rules
  const { remindersToFire } = evaluateRules(allReminders, event, currentState);

  // Fire notifications and update state
  for (const reminder of remindersToFire) {
    try {
      console.log(`[RuleEngine] Firing notification for: ${reminder.title}`);

      // Fire notification
      await fireNotification(reminder);

      // Mark as fired (fire once guarantee)
      const firedReminder: Reminder = {
        ...reminder,
        status: ReminderStatus.FIRED,
        firedAt: Date.now(),
      };

      console.log(`[RuleEngine] Updating reminder state to FIRED`);
      await updateReminderState(firedReminder);
      console.log(`[RuleEngine] ✅ Successfully fired and updated: ${reminder.title}`);
    } catch (error) {
      console.error(`[RuleEngine] ❌ Failed to fire reminder ${reminder.id}:`, error);
    }
  }
}
