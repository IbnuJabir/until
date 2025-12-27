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
  config: TriggerConfig = null
): Trigger {
  return {
    id: generateId(),
    type,
    config,
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
