# Trigger System Troubleshooting Guide

## Overview

This guide helps diagnose and fix issues with reminder triggers (charging, phone unlock, timer, and app opened).

## Root Causes Identified & Fixed

### 1. ✅ FIXED: Charging Trigger (BatteryModule Missing)

**Problem**: The charging trigger couldn't work because `BatteryModule.swift` was completely missing from the iOS project.

**Solution**: Created the following files:
- `/ios/BatteryModule.swift` - Native battery monitoring implementation
- `/ios/BatteryModule.m` - Objective-C bridge

**What was implemented**:
- UIDevice battery state monitoring
- CHARGING_STATE_CHANGED event emission
- Battery level tracking
- Proper event listener lifecycle management

**What you need to do**:
1. Open `ios/until.xcworkspace` in Xcode
2. Add the new files to the project:
   - Right-click on the `until` folder
   - Select "Add Files to 'until'..."
   - Select both `BatteryModule.swift` and `BatteryModule.m`
   - Ensure "Copy items if needed" is checked
   - Ensure the target "until" is selected
3. Build and run the app
4. Test charging trigger

### 2. ✅ ENHANCED: DeviceActivity Extension (App Opened Trigger)

**Problem**: The DeviceActivity extension may not be communicating with the main app, or events aren't being detected.

**Solution**: Added comprehensive logging to track event flow from extension to main app.

**What was enhanced**:
- Extension now logs every step of event processing with 🔥 emojis
- Verifies App Group write operations
- Tracks event data structure
- Main app logs extension status every 30 seconds

**What you need to do**:
1. **View extension logs** (CRITICAL for debugging):
   - Open Console.app on your Mac
   - Connect your iPhone/iPad
   - Select your device in the sidebar
   - In the search bar, enter: `DeviceActivityMonitor`
   - Filter by "Process: UntilDeviceActivityMonitor"
   - Look for messages with 🔥 emoji

2. **Verify extension is built and running**:
   ```bash
   # In Terminal, from project root:
   cd ios
   xcodebuild -workspace until.xcworkspace -scheme until -showBuildSettings | grep -i "extension"
   ```

3. **Check if extension target exists in Xcode**:
   - Open Xcode
   - Select project navigator (folder icon)
   - Click on the project root (blue icon)
   - In "Targets" list, verify "UntilDeviceActivityMonitor" is present
   - Select it and verify:
     - Bundle Identifier is correct
     - Signing & Capabilities has:
       - ✅ Family Controls
       - ✅ App Groups (group.com.ibnuj.until)

### 3. ✅ ENHANCED: Phone Unlock Trigger

**Problem**: Phone unlock trigger has all the code but might not be firing.

**Solution**: Added comprehensive logging to track the entire event flow.

**What was enhanced**:
- RuleEngine now logs every trigger evaluation for PHONE_UNLOCK
- Store logs all waiting reminders with PHONE_UNLOCK triggers
- Checks and displays activation time status

**What you need to do**: Follow the testing guide below.

### 4. ℹ️ TIMER/SCHEDULED_TIME Trigger

**Status**: Uses a different system (Expo Notifications), not part of the native event system.

**How it works**: Scheduled notifications are created using Expo's notification API and fire independently.

If not working:
- Check notification permissions
- Verify scheduled notifications exist: Check app notification settings

---

## Testing Guide

### Prerequisites

1. **Build the app in Xcode first** (not Expo Go):
   ```bash
   cd ios
   pod install
   ```
   Then open `until.xcworkspace` in Xcode and build.

2. **Add BatteryModule files to Xcode** (see Section 1 above)

3. **Enable verbose logging**:
   - Open Console.app on Mac
   - Filter by your device
   - Keep it visible while testing

### Test 1: Phone Unlock Trigger

1. **Create a test reminder**:
   - Open the app
   - Create a new reminder
   - Set title: "Test Phone Unlock"
   - Add trigger: "Phone Unlock"
   - Set activation time: "Now" or a few seconds from now
   - Save

2. **Check the Metro console logs**:
   ```
   Look for:
   [useNativeEvents] Setting up native event listeners...
   [Store] Total reminders in store: X
   [Store] Reminders with PHONE_UNLOCK triggers: 1
   ```

3. **Lock your phone** (press power button)

4. **Unlock your phone** (Face ID / Touch ID / passcode)

5. **Expected console output**:
   ```
   =================================================
   [useNativeEvents] 🔔 APP_BECAME_ACTIVE event received!
   [useNativeEvents] Event timestamp: 2026-01-30T...
   [useNativeEvents] Active reminders: 1
   =================================================
   [Store] 📥 handleEvent called
   [Store] Event type: APP_BECAME_ACTIVE
   [Store] 🔔 APP_BECAME_ACTIVE (Phone Unlock) event details:
   [Store]   Reminders with PHONE_UNLOCK triggers: 1
   [Store]     - "Test Phone Unlock" (id: ..., status: waiting)
   [Store]       Is active: ✅ YES
   [RuleEngine] 🔔 Evaluating APP_BECAME_ACTIVE (Phone Unlock) event
   [RuleEngine]   Match result: ✅ MATCHED
   [Store] 🔔 Calling notification service for: Test Phone Unlock
   ```

6. **If NOT working**:
   - Check if the reminder status is "waiting" (not "fired" or "expired")
   - Check activation time - if set in the future, it won't fire yet
   - Verify console shows "APP_BECAME_ACTIVE event received"
   - If no event at all → check AppLifecycleModule is linked in Xcode

### Test 2: Charging Trigger

1. **Build with new BatteryModule** (must add files to Xcode first!)

2. **Create a test reminder**:
   - Create new reminder
   - Set title: "Test Charging"
   - Add trigger: "When charging starts"
   - Set activation time: "Now"
   - Save

3. **Plug in your charger**

4. **Expected console output**:
   ```
   =================================================
   [useNativeEvents] 🔋 CHARGING_STATE_CHANGED event received!
   [useNativeEvents] Is charging: true
   =================================================
   [BatteryModule] 🔋 Sending CHARGING_STATE_CHANGED event - state: charging, isCharging: true
   [Store] 🔋 CHARGING_STATE_CHANGED event details:
   [Store]   Is charging: true
   [Store]   Reminders with CHARGING_STARTED triggers: 1
   [Store] 🔔 Calling notification service for: Test Charging
   ```

5. **If NOT working**:
   - Verify BatteryModule files are added to Xcode project
   - Check if module loads: Look for `[BatteryModule] Started monitoring battery notifications`
   - If no logs → module not linked, rebuild in Xcode
   - Check for `[useNativeEvents] Failed to enable battery monitoring` error

### Test 3: App Opened Trigger

**IMPORTANT**: This is the most complex trigger to test!

1. **Request Screen Time permission**:
   - Open app
   - Go to settings/permissions
   - Grant Family Controls permission

2. **Create a test reminder**:
   - Create new reminder
   - Set title: "Test App Opened"
   - Add trigger: "When I open apps"
   - Select apps using the picker (e.g., Safari, Messages)
   - Set activation time: "Now"
   - Save

3. **Check extension status**:
   Look for logs in Metro console:
   ```
   [useNativeEvents] Setting up APP_OPENED polling interval...
   [useNativeEvents] ℹ️ NOTE: DeviceActivity extension logs appear in system Console.app
   [useNativeEvents] 🔍 Polling for app opened events (poll #1)...
   ```

4. **Open Console.app** (on Mac, connected to your device):
   - Filter by: "DeviceActivityMonitor"
   - You should see:
   ```
   [DeviceActivityMonitor] 🚀 Extension initialized!
   [DeviceActivityMonitor] ✅ App Group accessible: group.com.ibnuj.until
   [DeviceActivityMonitor] 📱 Interval started: reminder_<uuid>
   ```

5. **Open one of the selected apps for 3+ seconds**:
   - Open the app you selected (e.g., Safari)
   - Use it for at least 3 seconds
   - Return to your reminder app

6. **Expected logs in Console.app** (extension):
   ```
   [DeviceActivityMonitor] 🔥🔥🔥 ========================================
   [DeviceActivityMonitor] 🔥🔥🔥 EVENT THRESHOLD REACHED!!!
   [DeviceActivityMonitor] 🔥 Activity Name: reminder_<uuid>
   [DeviceActivityMonitor] ✅✅✅ Successfully wrote event to App Group
   [DeviceActivityMonitor] ✅ Darwin notification posted
   ```

7. **Expected logs in Metro console** (main app):
   ```
   [useNativeEvents] Poll result: EVENT FOUND ✅
   [useNativeEvents] 📱 RAW APP_OPENED EVENT DETECTED
   [useNativeEvents]   Activity name (reminder ID): reminder_<uuid>
   [Store] APP_OPENED event details:
   [Store]   Reminders with APP_OPENED triggers: 1
   [Store] 🔔 Calling notification service for: Test App Opened
   ```

8. **If NOT working** - Systematic debugging:

   **Step A: Check if extension exists**
   ```bash
   # List all app extensions
   find ~/Library/Developer/Xcode/DerivedData -name "*.appex" | grep -i until
   ```
   - If no results → extension not built
   - Solution: Add extension target in Xcode

   **Step B: Check App Group access**
   - Look for "❌ FAILED to access App Group" in Console.app
   - If present → entitlements not configured
   - Solution: Verify both extension and main app have same App Group ID

   **Step C: Check if monitoring started**
   - Look for "Interval started" in Console.app
   - If missing → monitoring never began
   - Solution: Check extension status in app, re-save reminder

   **Step D: Check event threshold**
   - Open app for 3+ seconds (not just tap)
   - Look for "EVENT THRESHOLD REACHED" in Console.app
   - If missing → threshold not hit, keep app open longer

   **Step E: Check App Group communication**
   - Look for "Successfully wrote event to App Group" in Console.app
   - Look for "EVENT FOUND" in Metro console
   - If extension writes but main app doesn't read → App Group mismatch

   **Step F: Check activity name matching**
   - Extension logs activityName: `reminder_<uuid>`
   - Main app should have matching reminder with same activityName
   - Look for "Comparing" logs in RuleEngine
   - If no match → activityName mismatch, recreate reminder

---

## Common Issues & Solutions

### Issue: "BatteryModule not found"

**Symptoms**:
```
[BatteryBridge] ❌ BatteryModule not found!
```

**Solution**:
1. Stop Metro bundler
2. Open Xcode
3. Add `BatteryModule.swift` and `BatteryModule.m` to project
4. Clean build folder (Product → Clean Build Folder)
5. Rebuild app
6. Restart Metro

### Issue: "Extension not firing"

**Symptoms**:
- No logs in Console.app with "DeviceActivityMonitor"
- Polling shows "no event" every time

**Possible causes & solutions**:

1. **Extension not built**:
   - Check Xcode targets list
   - Ensure "UntilDeviceActivityMonitor" target exists
   - Build the extension target specifically

2. **Extension not signed**:
   - Select extension target in Xcode
   - Go to "Signing & Capabilities"
   - Select your team
   - Verify provisioning profile is valid

3. **App Groups not configured**:
   - Main app entitlements: Check `until.entitlements`
   - Extension entitlements: Check `UntilDeviceActivityMonitor.entitlements`
   - Both must have: `group.com.ibnuj.until`

4. **Screen Time permission not granted**:
   - Go to iPhone Settings → Screen Time → [Your App]
   - Verify permission is granted

### Issue: "Events detected but reminder doesn't fire"

**Symptoms**:
- Console shows "APP_BECAME_ACTIVE event received" (or other event)
- Console shows "handleEvent called"
- But no "Calling notification service" message

**Possible causes & solutions**:

1. **Reminder not in "waiting" status**:
   - Check reminder status in app
   - If "fired" or "expired", create a new test reminder

2. **Activation time in the future**:
   - Look for logs: "Trigger not yet active"
   - Set activation time to "Now" when creating reminder

3. **Wrong trigger type**:
   - Verify trigger matches event type
   - Phone unlock → PHONE_UNLOCK trigger
   - Charging → CHARGING_STARTED trigger
   - App opened → APP_OPENED trigger

4. **Conditions not met**:
   - Reminders can have conditions (time of day, location, etc.)
   - Check if conditions are blocking the reminder
   - Look for condition evaluation logs in console

### Issue: "Duplicate events"

**Symptoms**:
```
[useNativeEvents] ⏭️  Skipping duplicate event: ...
```

**Explanation**: This is normal! The system prevents the same event from firing multiple times.

**How it works**:
- Each event gets a unique ID: `activityName-timestamp`
- If same ID is seen again, it's skipped
- Prevents reminders from firing multiple times for the same event

### Issue: "Polling but no events in App Group"

**Symptoms**:
```
[useNativeEvents] 🔍 Polling for app opened events (poll #50)...
[useNativeEvents] Poll result: no event
```

**Debug steps**:

1. **Check if extension is alive**:
   ```javascript
   // In Metro console, run:
   import { checkExtensionStatus } from './app/src/native-bridge/ScreenTimeBridge';
   checkExtensionStatus().then(console.log);
   ```

   Expected output:
   ```json
   {
     "alive": true,
     "extensionAlive": 1738264800000,
     "appGroupId": "group.com.ibnuj.until",
     "activeActivities": ["reminder_abc123"]
   }
   ```

2. **If extensionAlive is old timestamp** (> 1 minute ago):
   - Extension may have crashed or not be running
   - Check device Console.app for crash logs
   - Rebuild and reinstall app

3. **If activeActivities is empty**:
   - No monitoring is active
   - Recreate the reminder
   - Check if startMonitoring() succeeded

---

## Debugging Checklist

Use this checklist when a trigger isn't working:

### Phone Unlock
- [ ] Reminder exists with PHONE_UNLOCK trigger
- [ ] Reminder status is "waiting"
- [ ] Activation time is now or in the past
- [ ] Console shows "APP_BECAME_ACTIVE event received"
- [ ] Console shows matching reminder in event handler
- [ ] No blocking conditions

### Charging
- [ ] BatteryModule files added to Xcode project
- [ ] App rebuilt after adding BatteryModule
- [ ] Reminder exists with CHARGING_STARTED trigger
- [ ] Reminder status is "waiting"
- [ ] Activation time is now or in the past
- [ ] Phone actually charging (not just plugged in)
- [ ] Console shows "CHARGING_STATE_CHANGED event received"

### App Opened
- [ ] Screen Time permission granted
- [ ] Extension target exists in Xcode
- [ ] Extension has App Groups entitlement
- [ ] Main app has App Groups entitlement
- [ ] Both use same App Group ID: `group.com.ibnuj.until`
- [ ] Reminder exists with APP_OPENED trigger
- [ ] Apps selected via FamilyActivityPicker
- [ ] Reminder status is "waiting"
- [ ] Console.app shows "Extension initialized"
- [ ] Console.app shows "Interval started"
- [ ] Opened app for 3+ seconds (not just tapped)
- [ ] Console.app shows "EVENT THRESHOLD REACHED"
- [ ] Metro shows "EVENT FOUND"

---

## Advanced Debugging

### Viewing All Reminders

To see all reminders and their current state:

```typescript
// In app code, add temporary logging:
const reminders = useReminderStore(state => state.reminders);
console.log('All reminders:', JSON.stringify(reminders, null, 2));
```

### Manually Firing an Event

To test if event handling works without triggering native events:

```typescript
// In app code:
const handleEvent = useReminderStore(state => state.handleEvent);

// Simulate phone unlock
handleEvent({
  type: 'APP_BECAME_ACTIVE',
  timestamp: Date.now(),
  data: {}
});

// Simulate charging
handleEvent({
  type: 'CHARGING_STATE_CHANGED',
  timestamp: Date.now(),
  data: { isCharging: true, level: 0.5, state: 'charging' }
});

// Simulate app opened
handleEvent({
  type: 'APP_OPENED',
  timestamp: Date.now(),
  data: { bundleId: 'reminder_<your-reminder-id>' }
});
```

### Resetting Everything

If all else fails, completely reset:

1. **Delete app from device**
2. **Clean Xcode**:
   ```bash
   cd ios
   rm -rf Pods
   rm -rf build
   pod install
   ```
3. **Clean Metro**:
   ```bash
   rm -rf node_modules
   npm install
   npx expo start --clear
   ```
4. **Rebuild in Xcode**
5. **Reinstall on device**
6. **Grant all permissions fresh**
7. **Create new test reminder**

---

## Architecture Reference

### Event Flow Diagrams

#### Phone Unlock Flow
```
UIApplication.didBecomeActive
  ↓
AppLifecycleModule.swift (sends APP_BECAME_ACTIVE)
  ↓
AppLifecycleBridge.ts (subscribes)
  ↓
useNativeEvents.ts (handler)
  ↓
reminderStore.handleEvent()
  ↓
RuleEngine.handleSystemEvent()
  ↓
RuleEngine.doesTriggerMatchEvent()
  ↓
Notification fires! 🎉
```

#### Charging Flow
```
UIDevice.batteryStateDidChange
  ↓
BatteryModule.swift (sends CHARGING_STATE_CHANGED)
  ↓
BatteryBridge.ts (subscribes)
  ↓
useNativeEvents.ts (handler)
  ↓
reminderStore.handleEvent()
  ↓
RuleEngine.handleSystemEvent()
  ↓
RuleEngine.doesTriggerMatchEvent()
  ↓
Notification fires! 🎉
```

#### App Opened Flow
```
User opens monitored app for 1+ second
  ↓
DeviceActivityMonitor.eventDidReachThreshold() [Extension]
  ↓
Write event to App Group (UserDefaults)
  ↓
Post Darwin notification
  ↓
useNativeEvents polling (every 3 seconds)
  ↓
ScreenTimeBridge.checkForAppOpenedEvents()
  ↓
Read from App Group (UserDefaults)
  ↓
reminderStore.handleEvent()
  ↓
RuleEngine.handleSystemEvent()
  ↓
RuleEngine.doesTriggerMatchEvent() [compares activityName]
  ↓
Notification fires! 🎉
```

### Key Files

**Native iOS**:
- `ios/BatteryModule.swift` - Battery monitoring (NEW)
- `ios/BatteryModule.m` - Battery bridge (NEW)
- `ios/AppLifecycleModule.swift` - Phone unlock events
- `ios/ScreenTimeModule.swift` - Screen Time API wrapper
- `ios/UntilDeviceActivityMonitor/DeviceActivityMonitor.swift` - Extension (ENHANCED)

**React Native Bridges**:
- `app/src/native-bridge/BatteryBridge.ts` - Battery interface
- `app/src/native-bridge/AppLifecycleBridge.ts` - App lifecycle interface
- `app/src/native-bridge/ScreenTimeBridge.ts` - Screen Time interface (ENHANCED)

**Event Handling**:
- `app/src/hooks/useNativeEvents.ts` - Event subscriptions (ENHANCED)
- `app/src/store/reminderStore.ts` - State management (ENHANCED)
- `app/src/engine/RuleEngine.ts` - Trigger matching logic (ENHANCED)

**Configuration**:
- `ios/until/until.entitlements` - Main app entitlements
- `ios/UntilDeviceActivityMonitor/UntilDeviceActivityMonitor.entitlements` - Extension entitlements

---

## Getting Help

If triggers still don't work after following this guide:

1. **Collect logs**:
   - Metro console output (full, from app launch)
   - Console.app output (filtered by "DeviceActivityMonitor")
   - Screenshots of reminder settings

2. **Check reminder configuration**:
   - Export reminder data (JSON)
   - Verify trigger types, configs, and activation times

3. **Verify build configuration**:
   - Run `xcodebuild -list` in ios/ folder
   - Confirm extension target exists
   - Check signing and entitlements

4. **Share diagnostic info**:
   - iOS version
   - App version
   - Xcode version
   - Whether using physical device or simulator (Screen Time only works on device!)

---

## Success Indicators

You'll know everything is working when you see:

### Phone Unlock
✅ Lock phone → unlock → notification appears within 1 second

### Charging
✅ Plug in charger → notification appears within 1-2 seconds

### App Opened
✅ Open monitored app → use for 3 seconds → notification appears within 3-6 seconds (next polling cycle)

### Timer
✅ Set timer → wait → notification appears at exact time

---

## Performance Notes

- **Battery impact**: BatteryModule only monitors when needed, disables on unmount
- **Polling overhead**: App polls every 3 seconds (minimal impact, can be adjusted)
- **Extension efficiency**: DeviceActivity extension only runs when threshold reached
- **Event deduplication**: Prevents duplicate notifications effectively

---

## Next Steps After Fixing

Once all triggers work:

1. **Remove excessive logging** (optional):
   - Keep error logs
   - Remove verbose debug logs (🔥, 📱, etc.)
   - Reduce polling status frequency

2. **Add error recovery**:
   - Auto-restart monitoring if it fails
   - Retry notification sends on failure
   - Surface errors to user in UI

3. **Add user-facing diagnostics**:
   - Show extension status in settings
   - Display last event timestamps
   - Show which triggers are active

4. **Optimize polling**:
   - Use Darwin notifications for immediate wake-up
   - Reduce polling interval when monitoring is active
   - Pause polling when no reminders are waiting

---

Last updated: 2026-01-30
