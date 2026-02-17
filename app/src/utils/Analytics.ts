/**
 * Analytics Service
 * Lightweight local analytics tracking for feature adoption and error monitoring.
 * Events are stored locally and can be exported from the debug screen.
 * Replace with a real analytics SDK (Mixpanel, Amplitude, PostHog) when ready.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const ANALYTICS_KEY = '@until_analytics';
const MAX_EVENTS = 500;

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string | number | boolean>;
  timestamp: number;
}

let eventBuffer: AnalyticsEvent[] = [];
let initialized = false;

/**
 * Initialize analytics — load persisted events
 */
export async function initAnalytics(): Promise<void> {
  if (initialized) return;
  try {
    const stored = await AsyncStorage.getItem(ANALYTICS_KEY);
    if (stored) {
      eventBuffer = JSON.parse(stored);
    }
    initialized = true;
  } catch {
    initialized = true;
  }
}

/**
 * Track an analytics event
 */
export async function trackEvent(
  name: string,
  properties?: Record<string, string | number | boolean>
): Promise<void> {
  const event: AnalyticsEvent = {
    name,
    properties,
    timestamp: Date.now(),
  };

  eventBuffer.push(event);

  // Trim to max size
  if (eventBuffer.length > MAX_EVENTS) {
    eventBuffer = eventBuffer.slice(-MAX_EVENTS);
  }

  // Persist (fire-and-forget)
  try {
    await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(eventBuffer));
  } catch {
    // Non-critical — swallow
  }
}

/**
 * Pre-defined event helpers
 */
export const Analytics = {
  reminderCreated: (triggerType: string) =>
    trackEvent('reminder_created', { triggerType }),

  reminderFired: (triggerType: string) =>
    trackEvent('reminder_fired', { triggerType }),

  reminderDeleted: () =>
    trackEvent('reminder_deleted'),

  permissionGranted: (type: string) =>
    trackEvent('permission_granted', { type }),

  permissionDenied: (type: string) =>
    trackEvent('permission_denied', { type }),

  onboardingCompleted: () =>
    trackEvent('onboarding_completed'),

  voiceReminderUsed: () =>
    trackEvent('voice_reminder_used'),

  appLaunched: () =>
    trackEvent('app_launched'),
};

/**
 * Get all stored analytics events (for debug/export)
 */
export async function getAnalyticsEvents(): Promise<AnalyticsEvent[]> {
  await initAnalytics();
  return [...eventBuffer];
}

/**
 * Clear all stored analytics events
 */
export async function clearAnalytics(): Promise<void> {
  eventBuffer = [];
  await AsyncStorage.removeItem(ANALYTICS_KEY);
}
