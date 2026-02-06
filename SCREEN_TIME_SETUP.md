# Screen Time API Implementation Guide

This guide explains how to complete the Screen Time API integration for the "Until" app.

## Overview

The app now includes:
- ✅ Native Swift module with Family Controls authorization
- ✅ FamilyActivityPicker for app selection
- ✅ React Native bridge and hooks
- ✅ UI integration in create reminder screen
- ⚠️ **PENDING**: DeviceActivity extension for actual app monitoring

## What Works Now

1. **Permission Request**: App can request Screen Time (Family Controls) permission
2. **App Selection**: User can select apps using Apple's official FamilyActivityPicker
3. **Token Storage**: Selected app tokens are stored in the native module
4. **UI Flow**: Complete flow in create reminder screen

## What's Missing: DeviceActivity Extension

To detect when monitored apps are opened, you need to create a **DeviceActivity Monitor Extension**. This is a separate extension target that runs independently from the main app.

### Why It's Required

- The Screen Time API doesn't provide real-time events to the main app
- DeviceActivity extensions monitor app usage in the background
- Extensions have strict memory limits (5MB) and limited execution time
- Communication happens via App Groups or notifications

---

## Step-by-Step: Adding DeviceActivity Extension

### Step 1: Create Extension Target in Xcode

1. Open the project in Xcode:
   ```bash
   cd ios
   open until.xcworkspace
   ```

2. In Xcode, go to **File → New → Target**

3. Select **iOS → Device Activity Monitor Extension**

4. Configure the extension:
   - **Product Name**: `UntilDeviceActivityMonitor`
   - **Team**: Your development team
   - **Bundle Identifier**: `com.ibnuj.until.deviceactivity`
   - Click **Finish**

5. When prompted "Activate 'UntilDeviceActivityMonitor' scheme?", click **Activate**

### Step 2: Configure App Groups

App Groups allow the extension to communicate with the main app.

1. In Xcode, select the main **until** target

2. Go to **Signing & Capabilities**

3. Click **+ Capability** and add **App Groups**

4. Click **+** under App Groups and create:
   ```
   group.com.ibnuj.until
   ```

5. Repeat steps 1-4 for the **UntilDeviceActivityMonitor** extension target

### Step 3: Add Family Controls Capability to Extension

1. Select the **UntilDeviceActivityMonitor** target

2. Go to **Signing & Capabilities**

3. Click **+ Capability** and add **Family Controls**

### Step 4: Implement DeviceActivityMonitor

Replace the generated `DeviceActivityMonitor.swift` file content with:

```swift
import DeviceActivity
import Foundation
import FamilyControls

/**
 * DeviceActivityMonitor Extension
 * Monitors app usage and triggers events when thresholds are met
 */
class UntilDeviceActivityMonitor: DeviceActivityMonitor {

    // App Group for communication with main app
    let appGroupId = "group.com.ibnuj.until"

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        print("[DeviceActivityMonitor] Interval started: \\(activity)")
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        print("[DeviceActivityMonitor] Interval ended: \\(activity)")
    }

    /**
     * Called when app usage threshold is reached
     * This fires when a monitored app is opened for at least 1 second
     */
    override func eventDidReachThreshold(
        _ event: DeviceActivityEvent.Name,
        activity: DeviceActivityName
    ) {
        super.eventDidReachThreshold(event, activity: activity)

        print("[DeviceActivityMonitor] Event threshold reached!")

        // Notify main app via App Groups
        notifyMainApp(event: event, activity: activity)
    }

    /**
     * Notify main app that a monitored app was opened
     */
    private func notifyMainApp(
        event: DeviceActivityEvent.Name,
        activity: DeviceActivityName
    ) {
        guard let sharedDefaults = UserDefaults(suiteName: appGroupId) else {
            print("[DeviceActivityMonitor] Failed to access App Group")
            return
        }

        // Store the event with timestamp
        let eventData: [String: Any] = [
            "eventName": event.rawValue,
            "activityName": activity.rawValue,
            "timestamp": Date().timeIntervalSince1970 * 1000, // milliseconds
            "type": "APP_OPENED"
        ]

        // Write to shared storage
        if let jsonData = try? JSONSerialization.data(withJSONObject: eventData) {
            sharedDefaults.set(jsonData, forKey: "lastAppOpenedEvent")
            sharedDefaults.synchronize()

            print("[DeviceActivityMonitor] Notified main app")
        }

        // Optional: Post Darwin notification for immediate wake-up
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName("com.ibnuj.until.appOpened" as CFString),
            nil,
            nil,
            true
        )
    }
}
```

### Step 5: Update Info.plist for Extension

The extension's Info.plist should already have the required keys. Verify it contains:

```xml
<key>NSExtension</key>
<dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.deviceactivity.monitor</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).UntilDeviceActivityMonitor</string>
</dict>
```

### Step 6: Start Monitoring in Main App

Update `ScreenTimeModule.swift` to start monitoring when apps are selected. Add this method:

```swift
@objc
func startMonitoring(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
) {
    guard !selectedAppTokens.isEmpty else {
        reject("NO_APPS", "No apps selected", nil)
        return
    }

    let schedule = DeviceActivitySchedule(
        intervalStart: DateComponents(hour: 0, minute: 0),
        intervalEnd: DateComponents(hour: 23, minute: 59),
        repeats: true
    )

    let activityName = DeviceActivityName("untilMonitoring")

    let event = DeviceActivityEvent(
        applications: selectedAppTokens,
        threshold: DateComponents(second: 1) // Minimum threshold
    )

    let center = DeviceActivityCenter()

    do {
        try center.startMonitoring(
            activityName,
            during: schedule,
            events: [DeviceActivityEvent.Name("appOpened"): event]
        )
        resolve(true)
    } catch {
        reject("MONITORING_ERROR", "Failed to start monitoring: \\(error.localizedDescription)", error)
    }
}
```

And add to the Objective-C bridge (`ScreenTimeModule.m`):

```objc
RCT_EXTERN_METHOD(startMonitoring:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
```

### Step 7: Poll for Events in Main App

Add a method to check for new app opened events from the extension:

```swift
@objc
func checkForAppOpenedEvents(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
) {
    guard let sharedDefaults = UserDefaults(suiteName: "group.com.ibnuj.until") else {
        resolve(nil)
        return
    }

    if let jsonData = sharedDefaults.data(forKey: "lastAppOpenedEvent"),
       let eventData = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {

        // Clear the event so we don't process it twice
        sharedDefaults.removeObject(forKey: "lastAppOpenedEvent")
        sharedDefaults.synchronize()

        // Emit to React Native
        if let timestamp = eventData["timestamp"] as? Double {
            emitAppOpenedEvent(appToken: "screen_time_app")
        }

        resolve(eventData)
    } else {
        resolve(nil)
    }
}
```

---

## Entitlements Required

### Main App Entitlements (until.entitlements)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.family-controls</key>
    <true/>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>group.com.ibnuj.until</string>
    </array>
</dict>
</plist>
```

### Extension Entitlements (UntilDeviceActivityMonitor.entitlements)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.family-controls</key>
    <true/>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>group.com.ibnuj.until</string>
    </array>
</dict>
</plist>
```

---

## Testing

### Testing Without App Store Approval

During development, you can test the permission flow and app picker:

1. Build and run from Xcode
2. Click "When I open an app" trigger
3. Grant Screen Time permission
4. Select apps in the picker

**Note**: The actual app monitoring won't work until Apple approves your Family Controls entitlement.

### Requesting Family Controls Entitlement

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Select your app identifier
4. Request **Family Controls** capability
5. Submit justification: "Context-aware reminder app that triggers reminders when user opens specific apps they choose"
6. Wait 3-6 weeks for approval

### Testing After Approval

1. Install app on device
2. Create a reminder with app trigger
3. Select apps (e.g., Instagram, Safari)
4. Save reminder
5. Open one of the selected apps
6. App should detect the opening after ~1 second
7. Reminder should fire

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                    User                              │
│  1. Grants Screen Time permission                   │
│  2. Selects apps in FamilyActivityPicker            │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│            ScreenTimeModule (Swift)                  │
│  • Stores app tokens (ApplicationToken)             │
│  • Starts DeviceActivity monitoring                  │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│     DeviceActivityMonitor Extension                  │
│  • Runs independently (5MB memory limit)             │
│  • Monitors app usage in background                  │
│  • Fires when threshold reached (1 second)           │
│  • Writes event to App Group                         │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              App Group Storage                       │
│  group.com.ibnuj.until                              │
│  • Shared UserDefaults                              │
│  • lastAppOpenedEvent: JSON                         │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│         Main App (Polling or Darwin)                 │
│  • Checks App Group for new events                   │
│  • Emits to React Native                            │
│  • Triggers reminder evaluation                      │
└─────────────────────────────────────────────────────┘
```

---

## Important Limitations

1. **Minimum Threshold**: 1 second is the minimum detection time
2. **Memory Limit**: Extension limited to 5MB RAM
3. **No App Names**: All app identifiers are tokenized (privacy)
4. **Entitlement Required**: Won't work without Apple approval
5. **iOS 15+**: Screen Time API only available on iOS 15 and later
6. **No Background Refresh**: Must poll or use Darwin notifications

---

## Troubleshooting

### Extension Not Loading

- Check bundle identifier matches: `com.ibnuj.until.deviceactivity`
- Verify extension is included in the build
- Check extension target's deployment info matches main app

### Events Not Firing

- Verify App Groups are configured correctly on both targets
- Check that monitoring was started successfully
- Ensure threshold is set to 1 second (minimum)
- Look for extension logs in Console.app (filter: "DeviceActivityMonitor")

### Permission Denied

- User must grant Screen Time permission
- Check NSFamilyControlsUsageDescription in Info.plist
- Verify Family Controls capability is enabled

---

## Next Steps

After completing the extension setup:

1. Test the complete flow on a physical device
2. Apply for Family Controls entitlement from Apple
3. Implement periodic polling in main app to check for events
4. Add error handling for extension failures
5. Monitor memory usage in the extension

---

## Resources

- [Apple DeviceActivity Documentation](https://developer.apple.com/documentation/deviceactivity)
- [Family Controls Framework](https://developer.apple.com/documentation/familycontrols)
- [App Groups Documentation](https://developer.apple.com/documentation/xcode/configuring-app-groups)
