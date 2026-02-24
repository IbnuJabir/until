# Analytics & Smart Notifications Plan - Until iOS App

## The Challenge

Until is designed as an **offline-first** app. Users create reminders locally, triggers fire locally, no server required. But you need visibility into:

1. **User metrics**: DAU, MAU, retention, feature adoption
2. **Subscription metrics**: Conversions, churn, revenue
3. **Engagement**: Which triggers are popular? Where do users drop off?
4. **Smart notifications**: Re-engage inactive users intelligently

The solution: **Queue events locally, sync when online** — the same pattern used by every major analytics SDK.

---

## Current State

### What Exists
- ✅ `Analytics.ts` — local event buffer with AsyncStorage persistence
- ✅ Basic event helpers: `reminderCreated`, `reminderFired`, `appLaunched`, etc.
- ✅ Max 500 events stored locally
- ✅ Export capability from debug screen

### What's Missing
- ❌ Real analytics backend (PostHog, Amplitude, Mixpanel)
- ❌ User identification
- ❌ Session tracking
- ❌ Funnel analysis
- ❌ Cohort analysis
- ❌ Push notification infrastructure
- ❌ Smart re-engagement logic

---

## Part 1: Analytics Integration

### Recommended: PostHog

**Why PostHog over alternatives:**

| Feature | PostHog | Mixpanel | Amplitude |
|---------|---------|----------|-----------|
| Self-hostable | ✅ | ❌ | ❌ |
| Free tier | 1M events/mo | 100K/mo | 10M/mo |
| Session replay | ✅ | ❌ | ✅ |
| Feature flags | ✅ | ❌ | ✅ |
| React Native SDK | ✅ | ✅ | ✅ |
| Offline queuing | ✅ | ✅ | ✅ |
| GDPR compliant | ✅ (EU hosting) | ✅ | ✅ |
| Open source | ✅ | ❌ | ❌ |

**PostHog gives you**: Product analytics, session replay, feature flags, A/B testing, and user surveys — all in one tool. And you can self-host if privacy is critical.

### Installation

```bash
npx expo install posthog-react-native expo-file-system expo-application expo-device expo-localization
```

### Implementation

**New file: `app/src/services/PostHogService.ts`**

```typescript
/**
 * PostHog Analytics Service
 * Handles initialization, identification, and event tracking
 * Events queue locally and sync when online (built into SDK)
 */

import { PostHog } from 'posthog-react-native';
import { Platform } from 'react-native';
import * as Application from 'expo-application';

// TODO: Move to environment variables
const POSTHOG_API_KEY = 'phc_YOUR_PROJECT_API_KEY';
const POSTHOG_HOST = 'https://us.i.posthog.com'; // or https://eu.i.posthog.com

let posthog: PostHog | null = null;

export async function initPostHog(): Promise<void> {
  if (posthog) return;

  posthog = new PostHog(POSTHOG_API_KEY, {
    host: POSTHOG_HOST,

    // Offline-first: queue events locally, batch send
    flushAt: 20,           // Send after 20 events queued
    flushInterval: 30000,  // Or every 30 seconds
    maxQueueSize: 1000,    // Store up to 1000 events offline
    maxBatchSize: 100,     // Send max 100 per batch

    // Session tracking
    sessionExpirationTimeSeconds: 1800, // 30 min inactivity = new session

    // Lifecycle events (recommended)
    captureAppLifecycleEvents: true,

    // Feature flags (useful for gradual rollouts)
    preloadFeatureFlags: true,
    sendFeatureFlagEvent: true,

    // Privacy
    disableGeoip: false, // Enable for country-level analytics
  });

  // Set super properties (sent with every event)
  posthog.register({
    app_version: Application.nativeApplicationVersion || 'unknown',
    build_number: Application.nativeBuildVersion || 'unknown',
    platform: Platform.OS,
  });

  console.log('[PostHog] Initialized');
}

/**
 * Identify user (call after user creates first reminder or signs up)
 * For anonymous users, PostHog auto-generates an ID
 */
export function identifyUser(userId: string, properties?: Record<string, any>): void {
  posthog?.identify(userId, properties);
}

/**
 * Track event with properties
 */
export function trackEvent(
  event: string,
  properties?: Record<string, string | number | boolean>
): void {
  posthog?.capture(event, properties);
}

/**
 * Set user properties (for segmentation)
 */
export function setUserProperties(properties: Record<string, any>): void {
  posthog?.identify(undefined, properties);
}

/**
 * Reset user (for logout)
 */
export function resetUser(): void {
  posthog?.reset();
}

/**
 * Opt out of tracking
 */
export function optOut(): void {
  posthog?.optOut();
}

/**
 * Opt back in
 */
export function optIn(): void {
  posthog?.optIn();
}

/**
 * Flush events immediately (call before app closes)
 */
export async function flushEvents(): Promise<void> {
  await posthog?.flush();
}

/**
 * Check feature flag
 */
export function getFeatureFlag(flag: string): boolean | string | undefined {
  return posthog?.getFeatureFlag(flag);
}

export { posthog };
```

### Update Analytics Wrapper

**Modify `app/src/utils/Analytics.ts`:**

```typescript
/**
 * Analytics Service
 * Wraps PostHog for consistent API and easy swapping
 */

import {
  initPostHog,
  trackEvent as posthogTrack,
  identifyUser,
  setUserProperties,
  flushEvents,
} from '../services/PostHogService';

let initialized = false;

export async function initAnalytics(): Promise<void> {
  if (initialized) return;
  await initPostHog();
  initialized = true;
}

export const Analytics = {
  // ===== User Events =====
  identify: (userId: string, properties?: Record<string, any>) =>
    identifyUser(userId, properties),

  setProperties: (properties: Record<string, any>) =>
    setUserProperties(properties),

  // ===== Reminder Events =====
  reminderCreated: (triggerType: string, triggerCount: number = 1) =>
    posthogTrack('reminder_created', { trigger_type: triggerType, trigger_count: triggerCount }),

  reminderFired: (triggerType: string, delayMinutes?: number) =>
    posthogTrack('reminder_fired', { trigger_type: triggerType, delay_minutes: delayMinutes }),

  reminderDeleted: (ageHours: number, wasFired: boolean) =>
    posthogTrack('reminder_deleted', { age_hours: ageHours, was_fired: wasFired }),

  reminderExpired: (triggerType: string) =>
    posthogTrack('reminder_expired', { trigger_type: triggerType }),

  // ===== Onboarding =====
  onboardingStarted: () =>
    posthogTrack('onboarding_started'),

  onboardingCompleted: (durationSeconds: number) =>
    posthogTrack('onboarding_completed', { duration_seconds: durationSeconds }),

  onboardingSkipped: (step: string) =>
    posthogTrack('onboarding_skipped', { skipped_at_step: step }),

  // ===== Permissions =====
  permissionRequested: (type: string) =>
    posthogTrack('permission_requested', { type }),

  permissionGranted: (type: string) =>
    posthogTrack('permission_granted', { type }),

  permissionDenied: (type: string) =>
    posthogTrack('permission_denied', { type }),

  // ===== Feature Usage =====
  voiceReminderStarted: () =>
    posthogTrack('voice_reminder_started'),

  voiceReminderCompleted: (durationSeconds: number) =>
    posthogTrack('voice_reminder_completed', { duration_seconds: durationSeconds }),

  voiceReminderFailed: (error: string) =>
    posthogTrack('voice_reminder_failed', { error }),

  locationSaved: (radius: number) =>
    posthogTrack('location_saved', { radius }),

  appSelected: (appCount: number) =>
    posthogTrack('app_selected', { app_count: appCount }),

  // ===== Paywall =====
  paywallViewed: (source: string) =>
    posthogTrack('paywall_viewed', { source }),

  purchaseStarted: (productId: string) =>
    posthogTrack('purchase_started', { product_id: productId }),

  purchaseCompleted: (productId: string, price: number) =>
    posthogTrack('purchase_completed', { product_id: productId, price }),

  purchaseFailed: (productId: string, error: string) =>
    posthogTrack('purchase_failed', { product_id: productId, error }),

  purchaseRestored: (productId: string) =>
    posthogTrack('purchase_restored', { product_id: productId }),

  // ===== App Lifecycle =====
  appLaunched: () =>
    posthogTrack('app_opened'), // PostHog convention

  appBackgrounded: () =>
    posthogTrack('app_backgrounded'),

  // ===== Errors =====
  errorOccurred: (screen: string, error: string) =>
    posthogTrack('error_occurred', { screen, error }),

  // ===== Flush =====
  flush: () => flushEvents(),
};
```

### App Initialization

**Update `app/_layout.tsx`:**

```typescript
import { initAnalytics, Analytics } from '@/app/src/utils/Analytics';
import { AppState, AppStateStatus } from 'react-native';

// In RootLayout:
useEffect(() => {
  // Initialize analytics
  initAnalytics().then(() => {
    Analytics.appLaunched();
  });

  // Flush events when app goes to background
  const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'background') {
      Analytics.appBackgrounded();
      Analytics.flush();
    }
  });

  return () => subscription.remove();
}, []);
```

---

## Part 2: Key Metrics to Track

### User Metrics (Dashboard)

| Metric | Event | How to Calculate |
|--------|-------|------------------|
| **DAU** | `app_opened` | Unique users per day |
| **MAU** | `app_opened` | Unique users per month |
| **Retention D1/D7/D30** | `app_opened` | % users returning after N days |
| **Session duration** | Built-in | PostHog auto-tracks |
| **Sessions per user** | Built-in | PostHog auto-tracks |

### Feature Adoption

| Metric | Event | Insight |
|--------|-------|---------|
| **Trigger type breakdown** | `reminder_created.trigger_type` | Which triggers are popular? |
| **Voice vs manual creation** | `voice_reminder_completed` vs `reminder_created` | Is voice useful? |
| **Location usage** | `location_saved` | Are users setting up places? |
| **App monitoring usage** | `app_selected` | Screen Time feature adoption |

### Subscription Funnel

```
app_opened → paywall_viewed → purchase_started → purchase_completed
                                    ↓
                            purchase_failed (why?)
```

| Metric | Calculation |
|--------|-------------|
| **Paywall view rate** | `paywall_viewed` / `app_opened` |
| **Conversion rate** | `purchase_completed` / `paywall_viewed` |
| **Trial-to-paid** | `purchase_completed` after trial / trial starts |

### Engagement Health

| Metric | Event | Action |
|--------|-------|--------|
| **Reminder success rate** | `reminder_fired` / `reminder_created` | Are reminders actually useful? |
| **Time to first reminder** | `reminder_created` - first `app_opened` | Onboarding effectiveness |
| **Reminders per user** | `reminder_created` count | Power users vs casual |

---

## Part 3: User Identification

### The Offline Challenge

Since Until has no auth/accounts, how do you identify users across sessions?

### Solution: Anonymous ID with Optional Account Link

```typescript
// On first app launch, generate a persistent anonymous ID
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import { v4 as uuidv4 } from 'uuid';

const USER_ID_KEY = 'until_user_id';

export async function getOrCreateUserId(): Promise<string> {
  let userId = await SecureStore.getItemAsync(USER_ID_KEY);

  if (!userId) {
    // First launch — generate ID
    userId = uuidv4();
    await SecureStore.setItemAsync(USER_ID_KEY, userId);
  }

  return userId;
}

// Call on app launch:
const userId = await getOrCreateUserId();
Analytics.identify(userId, {
  first_seen: Date.now(),
  platform: Platform.OS,
  app_version: Application.nativeApplicationVersion,
});
```

### User Properties for Segmentation

```typescript
// After first reminder created:
Analytics.setProperties({
  has_created_reminder: true,
  first_reminder_date: Date.now(),
});

// After subscription:
Analytics.setProperties({
  is_pro: true,
  subscription_product: 'monthly',
  subscription_date: Date.now(),
});

// Track free tier limits:
Analytics.setProperties({
  reminder_count: reminders.length,
  at_free_limit: reminders.length >= 3,
});
```

---

## Part 4: Smart Notifications (Re-engagement)

### The Problem

Users install the app, maybe create one reminder, then forget about it. How do you bring them back without being annoying?

### Solution Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PostHog                                │
│  (User segments: inactive, at_limit, trial_expiring, etc.) │
└────────────────────────┬────────────────────────────────────┘
                         │ Webhooks / Actions
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               Push Notification Service                     │
│    (OneSignal, Expo Push, Firebase Cloud Messaging)        │
└────────────────────────┬────────────────────────────────────┘
                         │ Push
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Until App                                │
│         (Receives push, shows notification)                 │
└─────────────────────────────────────────────────────────────┘
```

### Push Notification Options

| Service | Pros | Cons |
|---------|------|------|
| **Expo Push** | Built-in, free, simple | Less targeting options |
| **OneSignal** | Rich segmentation, free tier | Another SDK |
| **Firebase** | Industry standard, free | More setup |

**Recommendation**: Start with **Expo Push Notifications** (already in Expo). Add OneSignal later if you need advanced segmentation.

### Implementation: Expo Push

**1. Register for push tokens:**

```typescript
// app/src/services/PushService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Push] Must use physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  // Get Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'YOUR_EXPO_PROJECT_ID', // from app.json
  });

  return tokenData.data;
}

export async function sendPushTokenToServer(token: string, userId: string): Promise<void> {
  // Send to your backend (or PostHog as a user property)
  Analytics.setProperties({
    push_token: token,
    push_enabled: true,
  });

  // If you have a backend:
  // await fetch('https://your-api.com/push-tokens', {
  //   method: 'POST',
  //   body: JSON.stringify({ userId, token }),
  // });
}
```

**2. Smart notification triggers (backend required):**

For truly smart notifications, you need a backend that:
1. Queries PostHog for user segments
2. Sends push notifications via Expo's push API

**Simple version without backend:**

Use PostHog's **Actions & Webhooks** to trigger notifications:
- Create a cohort: "Users inactive 7+ days"
- Set up a webhook to your push service
- Or use PostHog's Zapier integration → OneSignal

### Smart Notification Scenarios

| Trigger | Segment | Message |
|---------|---------|---------|
| **Inactive 3 days** | No `app_opened` in 3 days | "Your reminders are waiting! 📍" |
| **At free limit** | `reminder_count = 3` + `is_pro = false` | "Unlock unlimited reminders with Pro" |
| **Trial ending** | Trial expires in 24h | "Your free trial ends tomorrow" |
| **Reminder success** | `reminder_fired` yesterday | "Nice! Your reminder worked. Create another?" |
| **New feature** | All users | "New: Voice reminders are here! 🎤" |

### Notification Frequency Rules

**Anti-annoyance policy:**
- Max 2 re-engagement pushes per week
- No pushes between 10pm-8am local time
- Stop after 3 ignored pushes
- Respect notification settings

```typescript
// Track notification engagement
Analytics.setProperties({
  last_push_sent: Date.now(),
  push_sent_count: (current.push_sent_count || 0) + 1,
});

// When user opens from push:
Notifications.addNotificationResponseReceivedListener((response) => {
  const source = response.notification.request.content.data?.source;
  if (source === 're-engagement') {
    posthogTrack('push_opened', { campaign: source });
  }
});
```

---

## Part 5: Privacy & Compliance

### GDPR/CCPA Considerations

1. **Consent**: Add analytics opt-out in settings
2. **Data access**: PostHog allows user data export
3. **Data deletion**: PostHog supports right-to-delete
4. **Data location**: Use `eu.i.posthog.com` for EU users

```typescript
// Settings screen:
const [analyticsEnabled, setAnalyticsEnabled] = useState(true);

const toggleAnalytics = async (enabled: boolean) => {
  setAnalyticsEnabled(enabled);
  if (enabled) {
    await optIn();
  } else {
    await optOut();
  }
  await AsyncStorage.setItem('@analytics_enabled', String(enabled));
};
```

### App Store Privacy Labels

For PostHog, declare:
- **Analytics**: Yes
- **Identifiers**: Device ID (anonymous)
- **Data linked to user**: No (unless you identify)
- **Tracking**: No (first-party analytics)

---

## Implementation Phases

### Phase 1: Core Analytics (Day 1-2)
- [ ] Install `posthog-react-native`
- [ ] Create `PostHogService.ts`
- [ ] Update `Analytics.ts` wrapper
- [ ] Initialize on app launch
- [ ] Add key events (see tracking plan)
- [ ] Test event capture in PostHog dashboard

### Phase 2: User Identification (Day 2)
- [ ] Generate anonymous user ID
- [ ] Identify on first launch
- [ ] Set user properties (is_pro, reminder_count, etc.)
- [ ] Verify in PostHog People view

### Phase 3: Dashboard Setup (Day 2-3)
- [ ] Create PostHog dashboards:
  - User metrics (DAU/MAU/retention)
  - Feature adoption
  - Subscription funnel
  - Error tracking
- [ ] Set up key insights and save

### Phase 4: Push Notifications (Day 3-4)
- [ ] Set up Expo push notifications
- [ ] Register push token on launch
- [ ] Store token in PostHog user properties
- [ ] Create backend endpoint for sending (or use third-party)

### Phase 5: Smart Campaigns (Day 4-5)
- [ ] Define re-engagement cohorts in PostHog
- [ ] Set up webhook triggers
- [ ] Connect to push service
- [ ] Test notification flow
- [ ] Monitor engagement rates

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `app/src/services/PostHogService.ts` | **Create** |
| `app/src/services/PushService.ts` | **Create** |
| `app/src/utils/Analytics.ts` | **Modify** - wrap PostHog |
| `app/_layout.tsx` | **Modify** - init + push registration |
| `app/settings.tsx` (if exists) | **Modify** - analytics toggle |
| `.env` or `app.config.ts` | **Modify** - add PostHog API key |

---

## Estimated Timeline

| Phase | Time |
|-------|------|
| PostHog setup + core events | 3-4 hours |
| User identification | 1-2 hours |
| Dashboard creation | 2-3 hours |
| Push notification setup | 2-3 hours |
| Smart campaigns | 3-4 hours |
| **Total** | **11-16 hours** |

---

## Questions for You

1. **PostHog vs alternatives**: Are you okay with PostHog? Or prefer Amplitude/Mixpanel?

2. **Self-hosted vs cloud**: PostHog Cloud (free tier 1M events/mo) or self-host?

3. **Push notifications**: Which service? Expo Push (simple) vs OneSignal (powerful)?

4. **Backend**: Do you have a backend for push campaigns, or should we use a no-code solution (PostHog → Zapier → OneSignal)?

5. **Privacy**: EU users? Need `eu.i.posthog.com` hosting?

---

## Approval Checklist

- [ ] Analytics provider confirmed (PostHog?)
- [ ] Cloud vs self-hosted decided
- [ ] Push notification service chosen
- [ ] Backend availability confirmed
- [ ] Privacy requirements clarified
- [ ] Ready to implement

Once approved, I'll create the implementation branch. ⚡️
