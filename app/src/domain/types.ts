/**
 * Domain Models for Context-Aware Reminder App
 * Following CONTEXT.md Phase 1 specification
 */

// ============================================================================
// TRIGGER TYPES
// ============================================================================

export enum TriggerType {
  TIME_WINDOW = 'TIME_WINDOW',
  SCHEDULED_TIME = 'SCHEDULED_TIME',
  PHONE_UNLOCK = 'PHONE_UNLOCK',
  LOCATION_ENTER = 'LOCATION_ENTER',
  CHARGING_STARTED = 'CHARGING_STARTED',
  APP_OPENED = 'APP_OPENED',
}

// ============================================================================
// REMINDER STATUS
// ============================================================================

export enum ReminderStatus {
  WAITING = 'waiting',
  FIRED = 'fired',
  EXPIRED = 'expired',
}

// ============================================================================
// TRIGGER CONFIGURATIONS
// ============================================================================

export interface TimeWindowConfig {
  startHour: number; // 0-23
  endHour: number; // 0-23
  daysOfWeek?: number[]; // 0-6 (Sunday = 0), optional
}

export interface ScheduledTimeConfig {
  scheduledDateTime: number; // Unix timestamp in milliseconds
}

export interface LocationConfig {
  latitude: number;
  longitude: number;
  radius: number; // meters
  name?: string; // user-friendly name like "Home", "Office"
}

export interface AppOpenedConfig {
  bundleId?: string; // e.g., "com.apple.mobilesafari" (legacy)
  activityName?: string; // Unique DeviceActivity name (e.g., "reminder_abc123")
  appName: string; // user-friendly name
}

export type TriggerConfig =
  | TimeWindowConfig
  | ScheduledTimeConfig
  | LocationConfig
  | AppOpenedConfig
  | null; // For PHONE_UNLOCK and CHARGING_STARTED (no config needed)

// ============================================================================
// TRIGGER
// ============================================================================

export interface Trigger {
  id: string;
  type: TriggerType;
  config: TriggerConfig;
  activationDateTime?: number; // Optional: Unix timestamp when trigger becomes active
}

// ============================================================================
// CONDITIONS
// ============================================================================

export enum ConditionType {
  TIME_RANGE = 'TIME_RANGE',
  DAY_OF_WEEK = 'DAY_OF_WEEK',
  IS_CHARGING = 'IS_CHARGING',
  AT_LOCATION = 'AT_LOCATION',
}

export interface TimeRangeConditionConfig {
  startHour: number;
  endHour: number;
}

export interface DayOfWeekConditionConfig {
  days: number[]; // 0-6
}

export interface LocationConditionConfig {
  latitude: number;
  longitude: number;
  radius: number;
}

export type ConditionConfig =
  | TimeRangeConditionConfig
  | DayOfWeekConditionConfig
  | LocationConditionConfig
  | boolean; // For IS_CHARGING

export interface Condition {
  id: string;
  type: ConditionType;
  config: ConditionConfig;
}

// ============================================================================
// REMINDER
// ============================================================================

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  triggers: Trigger[];
  conditions: Condition[];
  status: ReminderStatus;
  createdAt: number; // Unix timestamp
  firedAt?: number; // Unix timestamp when notification was sent
  expiresAt?: number; // Optional expiration timestamp
  notificationId?: string; // Scheduled notification ID for cancellation (SCHEDULED_TIME reminders)
}

// ============================================================================
// EVENT SYSTEM
// ============================================================================

export enum SystemEventType {
  APP_BECAME_ACTIVE = 'APP_BECAME_ACTIVE',
  CHARGING_STATE_CHANGED = 'CHARGING_STATE_CHANGED',
  LOCATION_REGION_ENTERED = 'LOCATION_REGION_ENTERED',
  APP_OPENED = 'APP_OPENED',
}

export interface SystemEvent {
  type: SystemEventType;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface ChargingEvent extends SystemEvent {
  type: SystemEventType.CHARGING_STATE_CHANGED;
  data: {
    isCharging: boolean;
    level?: number;
    state?: string;
  };
}

export interface LocationEvent extends SystemEvent {
  type: SystemEventType.LOCATION_REGION_ENTERED;
  data: {
    latitude: number;
    longitude: number;
    identifier: string;
  };
}

export interface AppOpenedEvent extends SystemEvent {
  type: SystemEventType.APP_OPENED;
  data: {
    bundleId: string;
  };
}

// ============================================================================
// SAVED PLACES
// ============================================================================

export interface SavedPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // Default radius for this place (50-500m)
  icon?: string; // Optional emoji icon
  address?: string; // Reverse geocoded address (optional)
  createdAt: number;
  lastUsedAt?: number;
  usageCount: number;
}

// ============================================================================
// PAYMENT / ENTITLEMENTS
// ============================================================================

export interface PaymentEntitlement {
  hasProAccess: boolean;
  subscriptionActive: boolean;
  productId?: string;
  purchaseDate?: number;
  expiryDate?: number;
}

export enum ProductId {
  MONTHLY = 'com.app.until.monthly',
  YEARLY = 'com.app.until.yearly',
}

// ============================================================================
// FREE TIER LIMITS
// ============================================================================

export const FREE_TIER_LIMITS = {
  MAX_REMINDERS: 3,
  ALLOWED_TRIGGERS: [TriggerType.TIME_WINDOW, TriggerType.PHONE_UNLOCK],
  BLOCKED_TRIGGERS: [
    TriggerType.LOCATION_ENTER,
    TriggerType.CHARGING_STARTED,
    TriggerType.APP_OPENED,
  ],
} as const;
