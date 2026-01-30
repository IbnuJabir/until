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
    // Log trigger activation time details for debugging
    console.log(`[RuleEngine] 🕐 Checking trigger activation time for reminder: "${reminder.title}"`);
    console.log(`[RuleEngine] 🕐 Trigger type: ${trigger.type}`);
    console.log(`[RuleEngine] 🕐 trigger.activationDateTime value: ${trigger.activationDateTime}`);
    console.log(`[RuleEngine] 🕐 trigger.activationDateTime (readable): ${trigger.activationDateTime ? new Date(trigger.activationDateTime).toLocaleString() : 'NOT SET'}`);
    console.log(`[RuleEngine] 🕐 event.timestamp value: ${event.timestamp}`);
    console.log(`[RuleEngine] 🕐 event.timestamp (readable): ${new Date(event.timestamp).toLocaleString()}`);

    // Check if trigger has an activation time and if it's not yet active
    if (trigger.activationDateTime && event.timestamp < trigger.activationDateTime) {
      console.log(`[RuleEngine] ⏸️ Trigger not yet active. Activation time: ${new Date(trigger.activationDateTime).toLocaleString()}, Current time: ${new Date(event.timestamp).toLocaleString()}`);
      return false;
    }

    console.log(`[RuleEngine] ✅ Trigger is active (no activation time set OR activation time has passed)`);

    switch (event.type) {
      case SystemEventType.APP_BECAME_ACTIVE: {
        console.log('[RuleEngine] 🔔 Evaluating APP_BECAME_ACTIVE (Phone Unlock) event');
        console.log('[RuleEngine]   Event timestamp:', new Date(event.timestamp).toISOString());
        console.log('[RuleEngine]   Trigger type:', trigger.type);
        console.log('[RuleEngine]   Expected type:', TriggerType.PHONE_UNLOCK);

        const matches = trigger.type === TriggerType.PHONE_UNLOCK;
        console.log(`[RuleEngine]   Match result: ${matches ? '✅ MATCHED' : '❌ NO MATCH'}`);

        if (matches) {
          console.log(`[RuleEngine] ✅ PHONE_UNLOCK trigger matched for reminder: ${reminder.id}`);
        }

        return matches;
      }

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
        console.log('[RuleEngine] 📱 Evaluating APP_OPENED event');
        console.log('[RuleEngine]   Event bundleId (activityName):', appEvent.data.bundleId);
        console.log('[RuleEngine]   Event timestamp:', new Date(appEvent.timestamp).toISOString());

        if (trigger.type !== TriggerType.APP_OPENED) {
          console.log('[RuleEngine]   ❌ Trigger type mismatch:', trigger.type);
          return false;
        }

        // Match by activity name - each reminder has a unique activity name
        const config = trigger.config as { activityName?: string; bundleId?: string };
        console.log('[RuleEngine]   Trigger config:', JSON.stringify(config));

        // New approach: match by activityName
        if (config?.activityName) {
          const matches = appEvent.data.bundleId === config.activityName;
          console.log(`[RuleEngine]   Comparing: "${appEvent.data.bundleId}" === "${config.activityName}"`);
          console.log(`[RuleEngine]   Match result: ${matches ? '✅ MATCHED' : '❌ NO MATCH'}`);

          if (matches) {
            console.log(`[RuleEngine] ✅ APP_OPENED trigger matched by activity name: ${config.activityName}`);
            return true;
          }
        } else {
          console.log('[RuleEngine]   ⚠️ No activityName in trigger config');
        }

        // Legacy fallback: wildcard matching for old reminders
        const isWildcard = config?.bundleId === 'screentime.apps.selected';
        if (isWildcard) {
          console.log(`[RuleEngine] ✅ APP_OPENED trigger matched (legacy wildcard)`);
          return true;
        }

        console.log('[RuleEngine]   ❌ No match found for this trigger');
        return false;
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
    expired: allReminders.filter(r => r.status === ReminderStatus.EXPIRED).length,
  });

  // For APP_OPENED events, show which reminders have APP_OPENED triggers
  if (event.type === SystemEventType.APP_OPENED) {
    const appOpenedReminders = allReminders.filter(r =>
      r.triggers.some(t => t.type === TriggerType.APP_OPENED)
    );
    console.log('[RuleEngine] 📱 Reminders with APP_OPENED triggers:', appOpenedReminders.length);
    appOpenedReminders.forEach(r => {
      const appTrigger = r.triggers.find(t => t.type === TriggerType.APP_OPENED);
      const config = appTrigger?.config as { activityName?: string } | undefined;
      console.log(`[RuleEngine]   - "${r.title}" (status: ${r.status}, activityName: ${config?.activityName || 'NOT SET'})`);
    });
  }

  // Step 1: Filter reminders listening to this event
  const listeningReminders = getRemindersListeningTo(allReminders, event);
  console.log('[RuleEngine] Reminders listening to this event:', listeningReminders.length);

  if (listeningReminders.length > 0) {
    listeningReminders.forEach(r => {
      console.log(`[RuleEngine] - "${r.title}" (${r.triggers.length} triggers, ${r.conditions.length} conditions)`);
    });
  } else {
    console.log('[RuleEngine] ⚠️ No reminders are listening to this event!');
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
