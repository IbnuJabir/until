/**
 * Validation functions for domain objects
 */

import {
  Reminder,
  Trigger,
  Condition,
  TriggerType,
  TimeWindowConfig,
  LocationConfig,
  AppOpenedConfig,
  ConditionType,
  TimeRangeConditionConfig,
  DayOfWeekConditionConfig,
  LocationConditionConfig,
} from './types';

/**
 * Validate a time window configuration
 */
export function validateTimeWindow(config: TimeWindowConfig): boolean {
  if (config.startHour < 0 || config.startHour > 23) return false;
  if (config.endHour < 0 || config.endHour > 23) return false;
  if (config.daysOfWeek) {
    if (!Array.isArray(config.daysOfWeek)) return false;
    if (config.daysOfWeek.some((day) => day < 0 || day > 6)) return false;
  }
  return true;
}

/**
 * Validate a location configuration
 */
export function validateLocation(config: LocationConfig): boolean {
  if (config.latitude < -90 || config.latitude > 90) return false;
  if (config.longitude < -180 || config.longitude > 180) return false;
  if (config.radius <= 0) return false;
  return true;
}

/**
 * Validate an app opened configuration
 */
export function validateAppOpened(config: AppOpenedConfig): boolean {
  if (!config.bundleId || config.bundleId.length === 0) return false;
  if (!config.appName || config.appName.length === 0) return false;
  return true;
}

/**
 * Validate a trigger
 */
export function validateTrigger(trigger: Trigger): boolean {
  switch (trigger.type) {
    case TriggerType.TIME_WINDOW:
      return trigger.config
        ? validateTimeWindow(trigger.config as TimeWindowConfig)
        : false;
    case TriggerType.LOCATION_ENTER:
      return trigger.config
        ? validateLocation(trigger.config as LocationConfig)
        : false;
    case TriggerType.APP_OPENED:
      return trigger.config
        ? validateAppOpened(trigger.config as AppOpenedConfig)
        : false;
    case TriggerType.PHONE_UNLOCK:
    case TriggerType.CHARGING_STARTED:
      return true; // No config required
    default:
      return false;
  }
}

/**
 * Validate a time range condition
 */
export function validateTimeRangeCondition(
  config: TimeRangeConditionConfig
): boolean {
  if (config.startHour < 0 || config.startHour > 23) return false;
  if (config.endHour < 0 || config.endHour > 23) return false;
  return true;
}

/**
 * Validate a day of week condition
 */
export function validateDayOfWeekCondition(
  config: DayOfWeekConditionConfig
): boolean {
  if (!Array.isArray(config.days)) return false;
  if (config.days.some((day) => day < 0 || day > 6)) return false;
  return true;
}

/**
 * Validate a location condition
 */
export function validateLocationCondition(
  config: LocationConditionConfig
): boolean {
  return validateLocation(config);
}

/**
 * Validate a condition
 */
export function validateCondition(condition: Condition): boolean {
  switch (condition.type) {
    case ConditionType.TIME_RANGE:
      return validateTimeRangeCondition(
        condition.config as TimeRangeConditionConfig
      );
    case ConditionType.DAY_OF_WEEK:
      return validateDayOfWeekCondition(
        condition.config as DayOfWeekConditionConfig
      );
    case ConditionType.AT_LOCATION:
      return validateLocationCondition(
        condition.config as LocationConditionConfig
      );
    case ConditionType.IS_CHARGING:
      return typeof condition.config === 'boolean';
    default:
      return false;
  }
}

/**
 * Validate a reminder
 */
export function validateReminder(reminder: Reminder): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Title validation
  if (!reminder.title || reminder.title.trim().length === 0) {
    errors.push('Title is required');
  }

  // Must have at least one trigger
  if (!reminder.triggers || reminder.triggers.length === 0) {
    errors.push('At least one trigger is required');
  }

  // Validate each trigger
  reminder.triggers.forEach((trigger, index) => {
    if (!validateTrigger(trigger)) {
      errors.push(`Invalid trigger at index ${index}`);
    }
  });

  // Validate each condition
  reminder.conditions.forEach((condition, index) => {
    if (!validateCondition(condition)) {
      errors.push(`Invalid condition at index ${index}`);
    }
  });

  // Check expiration
  if (reminder.expiresAt && reminder.expiresAt <= reminder.createdAt) {
    errors.push('Expiration date must be after creation date');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
