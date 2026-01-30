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
class DeviceActivityMonitorExtension: DeviceActivityMonitor {

    // App Group for communication with main app
    let appGroupId = "group.com.ibnuj.until"

    override init() {
        super.init()
        print("[DeviceActivityMonitor] 🚀 Extension initialized!")

        // Test App Group access immediately
        if let sharedDefaults = UserDefaults(suiteName: appGroupId) {
            let testKey = "extensionAlive"
            let timestamp = Date().timeIntervalSince1970
            sharedDefaults.set(timestamp, forKey: testKey)
            sharedDefaults.synchronize()
            print("[DeviceActivityMonitor] ✅ App Group accessible: \(appGroupId)")
        } else {
            print("[DeviceActivityMonitor] ❌ FAILED to access App Group: \(appGroupId)")
        }
    }

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        print("[DeviceActivityMonitor] 📱 ========================================")
        print("[DeviceActivityMonitor] 📱 INTERVAL STARTED")
        print("[DeviceActivityMonitor] 📱 Activity Name: \(activity.rawValue)")
        print("[DeviceActivityMonitor] 📱 Timestamp: \(Date())")
        print("[DeviceActivityMonitor] 📱 ========================================")

        // Write a marker to App Group when interval starts
        if let sharedDefaults = UserDefaults(suiteName: appGroupId) {
            let timestamp = Date().timeIntervalSince1970
            sharedDefaults.set(timestamp, forKey: "lastIntervalStart")
            sharedDefaults.set(activity.rawValue, forKey: "lastIntervalActivityName")
            sharedDefaults.synchronize()
            print("[DeviceActivityMonitor] ✅ Wrote interval start marker to App Group")
            print("[DeviceActivityMonitor] ✅ Activity: \(activity.rawValue) at \(timestamp)")
        } else {
            print("[DeviceActivityMonitor] ❌ CRITICAL: Failed to access App Group during interval start!")
        }
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

        print("[DeviceActivityMonitor] 🔥🔥🔥 ========================================")
        print("[DeviceActivityMonitor] 🔥🔥🔥 EVENT THRESHOLD REACHED!!!")
        print("[DeviceActivityMonitor] 🔥 Event Name: \(event.rawValue)")
        print("[DeviceActivityMonitor] 🔥 Activity Name: \(activity.rawValue)")
        print("[DeviceActivityMonitor] 🔥 Timestamp: \(Date())")
        print("[DeviceActivityMonitor] 🔥 Time (epoch): \(Date().timeIntervalSince1970)")
        print("[DeviceActivityMonitor] 🔥🔥🔥 ========================================")

        // Notify main app via App Groups
        notifyMainApp(event: event, activity: activity)

        print("[DeviceActivityMonitor] 🔥 Finished processing event threshold")
    }

    /**
     * Notify main app that a monitored app was opened
     */
    private func notifyMainApp(
        event: DeviceActivityEvent.Name,
        activity: DeviceActivityName
    ) {
        print("[DeviceActivityMonitor] 📤 Starting notifyMainApp...")
        print("[DeviceActivityMonitor] 📤 Event: \(event.rawValue)")
        print("[DeviceActivityMonitor] 📤 Activity: \(activity.rawValue)")

        guard let sharedDefaults = UserDefaults(suiteName: appGroupId) else {
            print("[DeviceActivityMonitor] ❌❌❌ CRITICAL: Failed to access App Group: \(appGroupId)")
            print("[DeviceActivityMonitor] ❌ This means the main app will NOT receive this event!")
            return
        }

        print("[DeviceActivityMonitor] ✅ App Group accessed successfully")

        // Store the event with timestamp
        let timestamp = Date().timeIntervalSince1970 * 1000
        let eventData: [String: Any] = [
            "eventName": event.rawValue,
            "activityName": activity.rawValue,
            "timestamp": timestamp, // milliseconds
            "type": "APP_OPENED"
        ]

        print("[DeviceActivityMonitor] 📦 Event data to write:")
        print("[DeviceActivityMonitor] 📦   eventName: \(event.rawValue)")
        print("[DeviceActivityMonitor] 📦   activityName: \(activity.rawValue)")
        print("[DeviceActivityMonitor] 📦   timestamp: \(timestamp)")
        print("[DeviceActivityMonitor] 📦   type: APP_OPENED")

        // Write to shared storage
        if let jsonData = try? JSONSerialization.data(withJSONObject: eventData) {
            sharedDefaults.set(jsonData, forKey: "lastAppOpenedEvent")
            let success = sharedDefaults.synchronize()

            print("[DeviceActivityMonitor] ✅✅✅ Successfully wrote event to App Group")
            print("[DeviceActivityMonitor] ✅ Key: lastAppOpenedEvent")
            print("[DeviceActivityMonitor] ✅ Synchronize result: \(success)")

            // Verify the write by reading it back
            if let readBack = sharedDefaults.data(forKey: "lastAppOpenedEvent") {
                print("[DeviceActivityMonitor] ✅ Verified: Event data exists in App Group (size: \(readBack.count) bytes)")
            } else {
                print("[DeviceActivityMonitor] ⚠️ WARNING: Could not verify written data!")
            }
        } else {
            print("[DeviceActivityMonitor] ❌❌❌ CRITICAL: Failed to serialize event data to JSON")
            return
        }

        // Post Darwin notification for immediate wake-up
        print("[DeviceActivityMonitor] 📡 Posting Darwin notification...")
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName("com.ibnuj.until.appOpened" as CFString),
            nil,
            nil,
            true
        )

        print("[DeviceActivityMonitor] ✅ Darwin notification posted: com.ibnuj.until.appOpened")
        print("[DeviceActivityMonitor] 📤 notifyMainApp completed successfully!")
    }
}
