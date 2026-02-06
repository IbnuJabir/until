# Screen Time Development Notes

## Current Status

✅ **ScreenTime module is properly integrated** - The native module is successfully communicating with React Native.

❌ **FamilyControls authorization failing** - This is expected without proper setup.

## Why It's Failing

The error "Couldn't communicate with a helper application" occurs because:

1. **Missing FamilyControls Entitlement**: We removed it from `ios/until/until.entitlements` to allow building with a free developer account.

2. **Free Developer Account**: Apple requires a **paid Apple Developer Program membership** ($99/year) to use FamilyControls.

3. **iOS 16+ Required**: The `requestAuthorization(for:)` API requires iOS 16.0 or later.

## To Enable Full Functionality

### 1. Get a Paid Apple Developer Account
- Enroll at https://developer.apple.com/programs/
- Cost: $99/year
- Required for FamilyControls capability

### 2. Re-add the FamilyControls Entitlement

In `ios/until/until.entitlements`, add:

```xml
<key>com.apple.developer.family-controls</key>
<true/>
```

The file should look like:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.security.application-groups</key>
	<array>
		<string>group.com.ibnuj.until</string>
	</array>
	<key>com.apple.developer.family-controls</key>
	<true/>
</dict>
</plist>
```

### 3. Test on iOS 16+ Device

- The simulator may have limited FamilyControls support
- Test on a real device running iOS 16.0 or later

## Current Development Workflow

While waiting for a paid developer account:

1. ✅ Build and run the app (works with free account)
2. ✅ Test other features (location, battery, time-based triggers)
3. ❌ ScreenTime/App Open triggers (requires paid account)

## What's Already Built

The following files are ready and working:

- `ios/ScreenTimeModule.swift` - Native module with FamilyControls integration
- `ios/ScreenTimeModule.m` - Objective-C bridge
- `ios/AppSelectionView.swift` - SwiftUI app picker interface
- `app/src/native-bridge/ScreenTimeBridge.ts` - TypeScript bridge
- `app/src/hooks/useScreenTime.ts` - React hook for easy usage

Once you add a paid developer account and the entitlement, everything will work immediately!

## Error Reference

**Current Error:**
```
Failed to request authorization: Couldn't communicate with a helper application.
```

**This will be fixed** once you have:
- ✅ Paid Apple Developer account
- ✅ FamilyControls entitlement enabled
- ✅ Testing on iOS 16+ device
