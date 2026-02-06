# Until iOS App - Build Guide

Complete guide for building and running the Until app on iOS devices and simulators.

---

## 🚀 Quick Start

### Option 1: iOS Simulator (Fastest)

```bash
npm run ios
```

### Option 2: Physical iPhone (Full Testing)

```bash
# 1. Open Xcode project
open ios/until.xcworkspace

# 2. In Xcode:
#    - Select your iPhone from device dropdown
#    - Go to Signing & Capabilities → Select your Team
#    - Press ▶️ Play button (⌘R)
```

---

## 📋 Prerequisites

### Required

- **macOS** (Monterey or later recommended)
- **Xcode** 15+ ([Download from App Store](https://apps.apple.com/us/app/xcode/id497799835))
- **Node.js** 18+ (currently using v22.19.0)
- **CocoaPods** (install: `sudo gem install cocoapods`)

### For Physical Device Testing

- **iPhone** with iOS 15+ (iOS 16+ recommended)
- **USB cable** to connect iPhone to Mac
- **Apple ID** (free account works for development)

---

## 🛠️ Build Scripts

We've created helper scripts to streamline the build process:

### 1. Build Only (No Run)

```bash
# Build for simulator
npm run build:ios

# Build for physical device
npm run build:ios:device
```

Or use the script directly:

```bash
./scripts/build-ios.sh simulator
./scripts/build-ios.sh device
```

### 2. Build + Run

```bash
# Run on simulator
npm run run:ios

# Run on physical device (requires device name)
npm run run:ios:device "Your iPhone Name"
```

Or use the script directly:

```bash
./scripts/run-ios.sh simulator
./scripts/run-ios.sh simulator "iPhone 14 Pro"
./scripts/run-ios.sh device "Kedir's iPhone"
```

### 3. Clean Build

If you encounter build errors, clean everything:

```bash
npm run clean:ios
```

This will:
- Delete build folders
- Remove Pods
- Clear Xcode derived data
- Clear Metro bundler cache
- Reinstall CocoaPods

### 4. Reinstall Pods Only

```bash
npm run pods
```

---

## 📱 Running on Physical iPhone

### Step 1: Prepare Your iPhone

1. **Enable Developer Mode**
   - Settings → Privacy & Security → Developer Mode → ON
   - Restart iPhone when prompted

2. **Connect via USB**
   - Use a USB cable (wireless not recommended for first build)

3. **Trust Your Mac**
   - Unlock iPhone
   - Tap "Trust" when prompted

### Step 2: Configure Xcode Signing

1. Open the Xcode workspace:
   ```bash
   open ios/until.xcworkspace
   ```

2. In Xcode:
   - Select `until` project in left sidebar
   - Select `until` target
   - Go to **"Signing & Capabilities"** tab

3. Set up your team:
   - **Automatically manage signing**: ✅ (checked)
   - **Team**: Select your Apple ID
     - If none listed, click "Add Account..."
     - Sign in with your Apple ID
   - **Bundle Identifier**: `com.ibnuj.until` (should be pre-filled)

4. Xcode will automatically:
   - Create a provisioning profile
   - Generate signing certificates
   - Configure entitlements

### Step 3: Build & Install

1. **Select your iPhone** from the device dropdown at the top of Xcode
   - It should appear as "Your iPhone Name (iOS 17.x)"

2. **Press the ▶️ Play button** (or press `⌘R`)

3. Xcode will:
   - Build the app
   - Install on your iPhone
   - Launch automatically

### Step 4: Trust Developer App (First Time Only)

On your iPhone:
- Settings → General → VPN & Device Management
- Under "Developer App", tap your Apple ID
- Tap "Trust" → "Trust"

Now the app will launch!

---

## 🐛 Troubleshooting

### ❌ "Signing for 'until' requires a development team"

**Solution:**
- Open Xcode
- Go to Signing & Capabilities
- Select your Team (Apple ID)

---

### ❌ "iPhone is not connected"

**Solutions:**
1. Unplug and replug USB cable
2. Unlock your iPhone
3. Tap "Trust" on iPhone
4. Restart Xcode
5. Try a different USB port

---

### ❌ "Developer Mode is not enabled on this device"

**Solution:**
- iPhone: Settings → Privacy & Security → Developer Mode → ON
- Restart iPhone

---

### ❌ "Failed to build iOS project. We ran 'xcodebuild' command but it exited with error code..."

**Solutions:**

1. **Clean build:**
   ```bash
   npm run clean:ios
   ```

2. **Reinstall Pods:**
   ```bash
   cd ios
   rm -rf Pods Podfile.lock
   pod install
   cd ..
   ```

3. **Open Xcode and check for errors:**
   ```bash
   open ios/until.xcworkspace
   ```
   - Look for red errors in Xcode
   - Build in Xcode (⌘B) to see detailed errors

4. **Clear Xcode derived data:**
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/until-*
   ```

---

### ❌ "Could not launch 'until'"

**Solution:**
- Unlock your iPhone
- Trust the developer certificate:
  - Settings → General → VPN & Device Management → Trust

---

### ❌ "The operation couldn't be completed. Unable to launch..."

**Solutions:**
1. Delete app from iPhone
2. Rebuild and reinstall
3. Restart iPhone
4. In Xcode: Product → Clean Build Folder (⇧⌘K)

---

### ❌ Metro bundler issues

**Solution:**
```bash
# Kill Metro
pkill -f metro

# Clear cache
rm -rf /tmp/metro-*
rm -rf /tmp/haste-map-*

# Restart
npm start
```

---

## 🧪 What You Can Test

### ✅ On Physical iPhone

- Phone unlock trigger (app foregrounding)
- Battery/charging state detection
- Location-based geofencing (requires going to actual locations)
- Push notifications
- Background behavior
- All native modules

### ⚠️ On Simulator (Limited)

- UI/UX and navigation
- Basic app logic
- ❌ Battery monitoring (not available)
- ❌ Geofencing (unreliable)
- ❌ True background behavior

---

## 📂 Project Structure

```
until/
├── ios/
│   ├── until.xcworkspace    ← Open this in Xcode
│   ├── until.xcodeproj
│   ├── Pods/
│   └── until/
│       ├── NativeModules/   ← Swift native modules
│       ├── Info.plist       ← Permissions configured
│       └── AppDelegate.swift
├── app/
│   └── src/
│       ├── domain/          ← Domain models
│       ├── engine/          ← Rule engine
│       ├── store/           ← State management
│       ├── storage/         ← SQLite database
│       ├── native-bridge/   ← React Native bridges
│       └── utils/           ← Notification service
└── scripts/
    ├── build-ios.sh         ← Build script
    ├── run-ios.sh           ← Run script
    └── clean-build.sh       ← Clean script
```

---

## 🔑 Key Files

- **[ios/until.xcworkspace](ios/until.xcworkspace)** - Open this in Xcode (NOT .xcodeproj)
- **[ios/until/Info.plist](ios/until/Info.plist)** - Location permissions configured
- **[package.json](package.json)** - Build scripts defined

---

## 💡 Tips

1. **Always open `.xcworkspace`**, never `.xcodeproj` (CocoaPods requirement)

2. **First build is slow** (~5-10 minutes). Subsequent builds are faster.

3. **Use physical device** for testing location, battery, and background features.

4. **Check Xcode console** for native module logs while debugging.

5. **Metro bundler must be running** for React Native updates. Start with:
   ```bash
   npm start
   ```

---

## 🎯 Next Steps After Successful Build

1. **Test phone unlock trigger:**
   - Lock iPhone → Unlock → App should detect

2. **Test charging trigger:**
   - Plug in charger → App should detect

3. **Test notifications:**
   - Create a reminder → Wait for trigger → Check notification

4. **Review logs:**
   - Xcode console shows native module logs
   - Metro console shows JavaScript logs

---

## 🆘 Still Having Issues?

1. **Check Xcode version:**
   ```bash
   xcodebuild -version
   ```
   Should be 15.0+

2. **Check Node version:**
   ```bash
   node --version
   ```
   Should be 18.0+

3. **Check iOS deployment target:**
   - Xcode → Project → Deployment Target should be iOS 13.0+

4. **Try the nuclear option:**
   ```bash
   npm run clean:ios
   rm -rf node_modules package-lock.json
   npm install
   cd ios && pod install && cd ..
   npm run ios
   ```

---

**Ready to build? Run:**

```bash
# For simulator
npm run ios

# For physical device
open ios/until.xcworkspace
```

Good luck! 🚀
