# Context-Aware Reminder App — Full System Design & Implementation Guide

> Goal: Build an iOS-first, React Native application that triggers reminders based on **real-life context**, not just time.

This document is written to guide an **AI coding agent** (or a human developer) through **incremental, safe, App-Store-compliant implementation**, following best practices and respecting iOS system constraints defined by **:contentReference[oaicite:0]{index=0}** and the **:contentReference[oaicite:1]{index=1}**.

---

## 1. Product Scope (Immutable)

### Supported Triggers (v1)
1. Time window
2. Phone unlock (foreground activation)
3. Location enter (geofencing)
4. Charging state change
5. App opened (via Screen Time APIs)

### Non-Goals (Explicitly Out of Scope)
- No backend / cloud sync
- No analytics
- No continuous background polling
- No private APIs
- No accessibility abuse
- No OR / nested trigger logic

---

## 2. Architectural Principles

- **Event-driven**, never polling
- **Local-first**, fully offline
- **Native-first for system events**
- **Declarative rules**, not imperative workflows
- **Explicit permissions**, no silent tracking
- **AND-only logic** for rule evaluation

---

## 3. Repository & Directory Structure

### Root Structure
```txt
context-reminder/
├── app/
│   ├── src/
│   │   ├── ui/                  # React Native screens & components
│   │   ├── store/               # Zustand / Redux logic
│   │   ├── domain/              # Reminder, Trigger, Condition models
│   │   ├── engine/              # Rule evaluation logic (JS)
│   │   ├── native-bridge/       # JS wrappers around native modules
│   │   └── utils/
│   └── index.tsx
├── ios/
│   ├── NativeModules/
│   │   ├── BatteryModule.swift
│   │   ├── AppLifecycleModule.swift
│   │   ├── LocationModule.swift
│   │   └── ScreenTimeModule.swift
│   └── AppDelegate.swift
├── docs/
│   ├── permissions.md
│   ├── architecture.md
│   └── testing.md
└── README.md
````

---

## 4. Phase 0 — Tooling & Environment Setup

### Requirements

* macOS
* Xcode (latest stable)
* Physical iPhone device (MANDATORY)
* Node.js LTS
* React Native CLI (not Expo)

### Why NOT Expo?

* Screen Time APIs require **custom native Swift modules**
* Background lifecycle hooks are required
* Expo adds unnecessary abstraction

---

## 5. Phase 1 — Domain Modeling (JS/TS Only)

### Reminder Model

```ts
Reminder {
  id: string
  title: string
  triggers: Trigger[]
  conditions: Condition[]
  status: 'waiting' | 'fired' | 'expired'
  createdAt: number
}
```

### Trigger Types

```ts
TIME_WINDOW
PHONE_UNLOCK
LOCATION_ENTER
CHARGING_STARTED
APP_OPENED
```

### Condition Rule

* ALL conditions must evaluate to `true`
* No OR, no nesting

---

## 6. Phase 2 — Rule Engine Core (JavaScript)

### Responsibilities

* Register reminders by trigger type
* Evaluate rules only when events occur
* Fire once
* Persist state changes

### Rule Evaluation Pseudocode

```ts
onEvent(event) {
  reminders = getRemindersListeningTo(event.type)

  for reminder in reminders:
    if allConditionsTrue(reminder):
      fireNotification(reminder)
      markAsFired(reminder)
}
```

### Important Constraints

* No timers
* No background loops
* No state mutation inside UI layer

---

## 7. Phase 3 — Native Event Sources (iOS)

> ALL system triggers MUST originate in native Swift code.

---

### 7.1 Phone Unlock Trigger

**Approximation Strategy**

* Listen for `UIApplication.didBecomeActive`
* Treat this as "phone unlocked or app foregrounded"

**Why This Is Safe**

* App Store compliant
* No private APIs
* ~90% accuracy

---

### 7.2 Charging State Trigger

**Implementation**

* Enable `UIDevice.isBatteryMonitoringEnabled`
* Observe `batteryStateDidChangeNotification`

**Fire When**

* State transitions to `.charging` or `.full`

---

### 7.3 Location Enter Trigger

**Implementation**

* CoreLocation geofencing
* Register regions per reminder

**Constraints**

* Max 20 regions (iOS limit)
* Use significant locations only
* Never do continuous GPS tracking

---

### 7.4 Time Window Trigger

**Strategy**

* Time is a **condition**, not a trigger
* Evaluated when other events fire

**Why**

* Avoid background timers
* Battery efficient

---

### 7.5 App Opened Trigger (Critical Feature)

**ONLY APPROVED METHOD**

* Screen Time APIs:

  * FamilyControls
  * DeviceActivity
  * ManagedSettings

**Flow**

1. Request Screen Time authorization
2. User selects apps explicitly
3. Register activity monitoring
4. Receive callback when app becomes active
5. Emit event to JS rule engine

**UX Copy (Mandatory)**

> “We only monitor apps you explicitly choose, to remind you at the right moment.”

**DO NOT**

* Infer apps silently
* Log usage
* Store usage history

---

## 8. Phase 4 — React Native ↔ Native Bridge

### Native Modules Must:

* Emit events only
* Contain NO business logic
* Be idempotent
* Be permission-aware

### JS Bridge Example

```ts
NativeEventEmitter.addListener(
  'CHARGING_STARTED',
  handleChargingEvent
)
```

---

## 9. Phase 5 — Notification System

### Type

* Local notifications only

### Requirements

* Fire once per reminder
* Cancel future notifications after fire
* No background fetch required

---

## 10. Phase 6 — Permissions Strategy (Very Important)

### Ask Permissions Just-In-Time

| Feature       | Permission Timing            |
| ------------- | ---------------------------- |
| Notifications | On first reminder            |
| Location      | When adding location trigger |
| Screen Time   | When adding app trigger      |

### Never ask all permissions on app launch.

## Phase 11 — Payments, Monetization & Paywall Integration (FINAL BEFORE TESTING)

> Objective: Integrate a **clean, emotionally respectful paywall** that converts without harming trust, and is fully compliant with iOS App Store policies.

This phase MUST be implemented **after all core features are stable**, and **before final testing**.

---

## 11.1 Monetization Philosophy (Critical Context)

This app does **not** sell features.
It sells **relief from mental load**.

The paywall must feel:
- Calm
- Optional
- Honest
- Non-pushy
- Respectful of privacy

DO NOT:
- Guilt users
- Block core functionality abruptly
- Use dark patterns
- Auto-show paywall on first launch

---

## 11.2 Pricing Model (Required)

### Subscription Type
- **Auto-renewing subscription**
- Monthly + yearly options

### Recommended Pricing
- Monthly: **$2.99 – $4.99**
- Yearly: **$19.99 – $29.99**

Yearly must show clear savings.

---

## 11.3 Free vs Paid Feature Split (MANDATORY)

### Free Tier (Trust Builder)
The free version must be **fully usable**, but intentionally constrained.

Allowed in Free:
- Up to **3 active reminders**
- Triggers:
  - Time window
  - Phone unlock
- Basic notifications

Blocked in Free:
- Location triggers
- Charging triggers
- App opened triggers
- Unlimited reminders

---

### Paid Tier (Unlocks Context)

Paid users get:
- Unlimited reminders
- Location enter triggers
- Charging state triggers
- App opened triggers (Screen Time)
- Compound triggers
- Priority notification reliability

---

## 11.4 Paywall Trigger Strategy (When to Show It)

### DO show paywall when:
- User tries to add 4th reminder
- User selects a locked trigger
- User tries to enable Screen Time app triggers
- User wants unlimited reminders

### DO NOT show paywall:
- On first launch
- Before user creates at least one reminder
- Randomly
- On app open

Paywall must be **contextual**, not interruptive.

---

## 11.5 Paywall Copy (Emotion-Driven, Non-Brand)

### Title
> “Wait less. Remember better.”

### Subtitle
> “Unlock reminders that wait for the right moment.”

### Bullet Points (Max 3)
- Remind me when I’m already there  
- Remind me when I open the app  
- Remind me when I’m actually free  

### CTA
- “Unlock full access”
- “Start free trial” (optional)

### Secondary Action
- “Not now”

---

## 11.6 Trial Strategy (Optional but Recommended)

### Trial Type
- 7-day free trial
- Auto-renews after trial ends

### Trial Rules
- Trial unlocks **all triggers**
- User must explicitly confirm subscription
- Trial must be cancellable in iOS Settings

---

## 11.7 Technical Implementation (iOS-Compliant)

### Payment System
- **Apple In-App Purchases ONLY**
- Use StoreKit 2
- DO NOT use Stripe, Paddle, PayPal for digital features

---

### Recommended Library
- `react-native-iap`

### Products
```txt
com.app.until.monthly
com.app.until.yearly
```
---

## 12. Phase 7 — UI/UX Guidelines

### Reminder Creation UX

* Sentence-based configuration
* Hide technical language
* Example:

  > “Remind me when I unlock my phone after 6pm”

### Avoid:

* Forms
* Advanced settings
* Toggle overload

---

## 13. Phase 8 — Storage & Persistence

### Recommended

* SQLite or MMKV
* No iCloud
* No sync

### Persist:

* Reminder definitions
* Trigger registrations
* Fired state

---

## 14. Phase 9 — Testing Strategy

### Simulator (Limited Use)

✅ UI
✅ Navigation
❌ Battery
❌ Location
❌ Screen Time
❌ Background

### Real Device (MANDATORY)

✅ All triggers
✅ Permission flows
✅ Background behavior

---

## 15. Phase 10 — App Store Readiness

### MUST HAVE

* Clear permission copy
* Honest feature descriptions
* No hidden tracking
* Screen Time explanation

### WILL FAIL REVIEW IF

* You monitor apps without consent
* You use accessibility APIs improperly
* You poll system state continuously

---

## 16. MVP vs v1 Roadmap

### MVP (Weekend Build)

* Time window
* Charging
* Phone unlock
* Location (limited)

### v1 (1–2 weeks later)

* Screen Time app triggers
* UX polish
* Store submission

---

## 17. Final Engineering Truths

* This is not a CRUD app
* This is not trivial
* This IS defensible
* This IS worth building

If implemented correctly, this app delivers **real emotional value** by reminding people at the *right moment*, not the scheduled one.

---

END OF DOCUMENT

```
