# Device Activity Extension Setup Guide

This guide explains how to enable **actual app detection** for the "When I open an app" trigger.

## Current Status

✅ **What Works:**
- App selection via FamilyActivityPicker
- Permission requests
- Storing selected apps
- UI displaying selected apps

❌ **What Doesn't Work:**
- **Detecting when apps are opened** (requires this setup)

---

## Why This Is Needed

Apple's Screen Time API requires a **DeviceActivity Monitor Extension** to detect when apps are opened. This is a separate iOS extension that runs independently from your main app and communicates via App Groups.

---

## Step-by-Step Setup

### Step 1: Create the DeviceActivity Extension in Xcode

1. Open the project in Xcode:
   ```bash
   cd ios
   open until.xcworkspace
   ```

2. In Xcode menu: **File → New → Target**

3. In the template chooser:
   - Filter by "Device"
   - Select **"Device Activity Monitor Extension"**
   - Click **Next**

4. Configure the extension:
   - **Product Name**: `UntilDeviceActivityMonitor`
   - **Organization Identifier**: `com.ibnuj`
   - **Bundle Identifier**: `com.ibnuj.until.deviceactivity` (auto-filled)
   - **Language**: Swift
   - **Project**: until
   - Click **Finish**

5. When prompted **"Activate 'UntilDeviceActivityMonitor' scheme?"**:
   - Click **Activate**

---

### Step 2: Configure App Groups

App Groups allow the extension to communicate with the main app.

#### For Main App:

1. In Xcode Project Navigator, select the **until** project (blue icon at top)
2. Select the **until** target (under TARGETS)
3. Go to **Signing & Capabilities** tab
4. Click **+ Capability** (top left)
5. Search for and add **"App Groups"**
6. Click **+** under App Groups
7. Enter: `group.com.ibnuj.until`
8. Make sure the checkbox is checked

#### For Extension:

1. Select the **UntilDeviceActivityMonitor** target (under TARGETS)
2. Go to **Signing & Capabilities** tab
3. Click **+ Capability**
4. Add **"App Groups"**
5. Click **+** under App Groups
6. Enter: `group.com.ibnuj.until`
7. Make sure the checkbox is checked

---

### Step 3: Add Family Controls to Extension

1. With **UntilDeviceActivityMonitor** target still selected
2. Go to **Signing & Capabilities** tab
3. Click **+ Capability**
4. Search for and add **"Family Controls"**

---

### Step 4: Replace DeviceActivityMonitor.swift

1. In the Project Navigator, expand **UntilDeviceActivityMonitor** folder
2. You'll see a file named `DeviceActivityMonitor.swift`
3. Delete this file (Right-click → Delete → Move to Trash)
4. **Drag and drop** the file from:
   ```
   ios/until/NativeModules/DeviceActivityMonitor.swift
   ```
   into the **UntilDeviceActivityMonitor** folder in Xcode

5. In the dialog:
   - ✅ Check **"Copy items if needed"**
   - ✅ Make sure **UntilDeviceActivityMonitor** target is selected
   - Click **Finish**

---

### Step 5: Verify Extension Info.plist

1. In UntilDeviceActivityMonitor folder, open **Info.plist**
2. Verify it contains:
   ```xml
   <key>NSExtension</key>
   <dict>
       <key>NSExtensionPointIdentifier</key>
       <string>com.apple.deviceactivity.monitor</string>
       <key>NSExtensionPrincipalClass</key>
       <string>$(PRODUCT_MODULE_NAME).UntilDeviceActivityMonitor</string>
   </dict>
   ```

---

### Step 6: Build and Run

1. **Clean Build Folder**: Product → Clean Build Folder (Cmd+Shift+K)
2. **Select your physical device** (not simulator - Screen Time doesn't work in simulator)
3. **Build**: Product → Build (Cmd+B)
4. **Run**: Product → Run (Cmd+R)

---

## Testing

1. **Create a reminder** with "When I open an app" trigger
2. **Select apps** (e.g., Safari, Messages)
3. **Check logs** - you should see:
   ```
   [ScreenTimeModule] ✅ Monitoring started successfully
   [ScreenTimeModule] - Apps: 2
   ```
4. **Open one of the selected apps** (e.g., Safari)
5. **Wait ~1 second**
6. **Check logs** for:
   ```
   [DeviceActivityMonitor] ✅ Event threshold reached!
   [DeviceActivityMonitor] ✅ Notified main app via App Group
   ```
7. The **reminder should fire** (notification appears)

---

## Troubleshooting

### "No apps selected for monitoring"
- Make sure you selected apps using the FamilyActivityPicker
- Check logs for selected app count

### "App Group not accessible"
- Verify App Groups are configured correctly in both targets
- Make sure `group.com.ibnuj.until` is spelled correctly
- Check that checkboxes are enabled

### "Monitoring failed to start"
- Ensure you have Screen Time permission granted
- Check that Family Controls capability is added to extension
- Try restarting the device

### Extension not firing
- Make sure the extension target is building (check scheme)
- Verify DeviceActivityMonitor.swift is in the extension target
- Check that you're testing on a physical device (not simulator)
- Look for extension logs in Console.app (search for "DeviceActivityMonitor")

### Still not working?
1. Clean build folder (Cmd+Shift+K)
2. Delete app from device
3. Rebuild and reinstall
4. Grant permissions again

---

## Architecture

```
User opens Instagram
         ↓
iOS System detects (via Screen Time API)
         ↓
DeviceActivityMonitor Extension fires
         ↓
Extension writes event to App Group
         ↓
Main app reads event from App Group
         ↓
RuleEngine evaluates reminders
         ↓
Notification fires
```

---

## Important Notes

1. **Physical Device Only**: Screen Time API doesn't work in iOS Simulator
2. **iOS 16.0+**: DeviceActivity requires iOS 16 or later
3. **1 Second Delay**: Events fire after app is open for 1 second (Apple's minimum threshold)
4. **Privacy**: App names are never exposed - only opaque tokens
5. **Background**: Extension runs independently, even when main app is closed

---

## Code Changes Made

All code has been prepared for you:

✅ `ios/until/NativeModules/DeviceActivityMonitor.swift` - Extension implementation
✅ `ios/ScreenTimeModule.swift` - Updated with monitoring methods
✅ `ios/ScreenTimeModule.m` - Updated Objective-C bridge
✅ `app/src/native-bridge/ScreenTimeBridge.ts` - Updated TypeScript bridge
✅ `ios/until/until.entitlements` - Added App Groups

You only need to:
1. Create the extension target in Xcode (Steps 1-5 above)
2. Build and run

---

## Next Steps After Setup

Once the extension is working:

1. Test with different apps
2. Test with app categories
3. Verify reminders fire reliably
4. Test with multiple reminders

---

## Support

If you encounter issues:
1. Check Xcode console for logs
2. Open Console.app and search for "DeviceActivityMonitor"
3. Verify all capabilities are configured
4. Make sure you're on iOS 16.0+

---

**Need help?** Review the logs carefully - they contain detailed information about what's happening at each step.
