/**
 * Factory functions for creating domain objects
 */

import { randomUUID } from 'expo-crypto';
import {
  Reminder,
  Trigger,
  Condition,
  ReminderStatus,
  TriggerType,
  TriggerConfig,
  ConditionType,
  ConditionConfig,
  SavedPlace,
  ScheduledTimeConfig,
} from './types';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * Create a new Reminder
 */
export function createReminder(
  title: string,
  triggers: Trigger[],
  conditions: Condition[] = [],
  description?: string
): Reminder {
  return {
    id: generateId(),
    title,
    description,
    triggers,
    conditions,
    status: ReminderStatus.WAITING,
    createdAt: Date.now(),
  };
}

/**
 * Create a new Trigger
 */
export function createTrigger(
  type: TriggerType,
  config: TriggerConfig = null,
  activationDateTime?: number
): Trigger {
  return {
    id: generateId(),
    type,
    config,
    activationDateTime,
  };
}

/**
 * Create a new Condition
 */
export function createCondition(
  type: ConditionType,
  config: ConditionConfig
): Condition {
  return {
    id: generateId(),
    type,
    config,
  };
}

/**
 * Mark a reminder as fired
 */
export function markReminderAsFired(reminder: Reminder): Reminder {
  return {
    ...reminder,
    status: ReminderStatus.FIRED,
    firedAt: Date.now(),
  };
}

/**
 * Mark a reminder as expired
 */
export function markReminderAsExpired(reminder: Reminder): Reminder {
  return {
    ...reminder,
    status: ReminderStatus.EXPIRED,
  };
}

/**
 * Check if a reminder is active (waiting)
 */
export function isReminderActive(reminder: Reminder): boolean {
  return reminder.status === ReminderStatus.WAITING;
}

/**
 * Check if a reminder has expired
 */
export function hasReminderExpired(reminder: Reminder): boolean {
  if (!reminder.expiresAt) {
    return false;
  }
  return Date.now() > reminder.expiresAt;
}

/**
 * Create a scheduled time trigger
 */
export function createScheduledTimeTrigger(scheduledDateTime: number): Trigger {
  const config: ScheduledTimeConfig = {
    scheduledDateTime,
  };
  return createTrigger(TriggerType.SCHEDULED_TIME, config);
}

/**
 * Create a new SavedPlace
 */
export function createSavedPlace(
  name: string,
  latitude: number,
  longitude: number,
  radius: number = 100,
  icon?: string,
  address?: string
): SavedPlace {
  return {
    id: generateId(),
    name,
    latitude,
    longitude,
    radius,
    icon,
    address,
    createdAt: Date.now(),
    usageCount: 0,
  };
}
