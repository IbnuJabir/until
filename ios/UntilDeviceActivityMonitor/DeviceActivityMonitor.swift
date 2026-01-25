import DeviceActivity
import Foundation
import FamilyControls

/**
 * DeviceActivityMonitor Extension Implementation
 *
 * IMPORTANT: This file needs to be added to the DeviceActivity Monitor Extension target.
 * Follow these steps:
 * 1. Create the extension in Xcode: File → New → Target → Device Activity Monitor Extension
 * 2. Replace the generated DeviceActivityMonitor.swift with this file
 * 3. Configure App Groups: group.com.ibnuj.until
 * 4. Add Family Controls capability to the extension target
 */

@available(iOS 16.0, *)
class UntilDeviceActivityMonitor: DeviceActivityMonitor {

    // App Group for communication with main app
    let appGroupId = "group.com.ibnuj.until"

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        print("[DeviceActivityMonitor] Interval started: \(activity)")
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        print("[DeviceActivityMonitor] Interval ended: \(activity)")
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

        print("[DeviceActivityMonitor] ✅ Event threshold reached!")
        print("[DeviceActivityMonitor] Event: \(event.rawValue)")
        print("[DeviceActivityMonitor] Activity: \(activity.rawValue)")

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
            print("[DeviceActivityMonitor] ❌ Failed to access App Group: \(appGroupId)")
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

            print("[DeviceActivityMonitor] ✅ Notified main app via App Group")
        } else {
            print("[DeviceActivityMonitor] ❌ Failed to serialize event data")
        }

        // Post Darwin notification for immediate wake-up
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName("com.ibnuj.until.appOpened" as CFString),
            nil,
            nil,
            true
        )

        print("[DeviceActivityMonitor] ✅ Posted Darwin notification")
    }

    override func warningDidReachThreshold(
        _ event: DeviceActivityEvent.Name,
        activity: DeviceActivityName
    ) {
        super.warningDidReachThreshold(event, activity: activity)
        print("[DeviceActivityMonitor] Warning threshold reached: \(event)")
    }
}
