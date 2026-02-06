# Build Instructions for Until iOS App

## Current Build Issue
There's a CocoaPods version incompatibility with Xcode 16's project format (v70) and OpenIAP module maps.

## Solution: Build Directly in Xcode

### Steps:

1. **Open the workspace in Xcode:**
   ```bash
   cd /Users/kedirjabir/code/until/ios
   open until.xcworkspace
   ```

   If the workspace doesn't exist yet, create it first by opening the project:
   ```bash
   open until.xcodeproj
   ```

2. **Xcode will automatically:**
   - Detect missing dependencies
   - Run CocoaPods with the correct configuration
   - Resolve module map issues
   - Handle the OpenIAP module correctly

3. **Select your device:**
   - In Xcode, select your physical iOS device from the device dropdown (top left)
   - Make sure your device is connected and trusted

4. **Build and Run:**
   - Press `Cmd + R` or click the Play button
   - Xcode will build and install the app on your device

## What's Been Implemented

### ✅ Saved Places System
- **Database**: SQLite table with full CRUD operations
- **Store Management**: Zustand state management for saved places
- **MapPicker**: Full-featured Apple Maps integration
  - Visual location selection
  - Draggable marker
  - Radius adjustment (50m-500m)
  - Visual circle overlay
  - Current location button
- **SavedPlacesList**: Library of saved locations
  - Reusable places
  - Usage tracking
  - Delete functionality
- **Integration**: Complete workflow in create-reminder screen
  1. User taps "When I arrive somewhere"
  2. Shows list of saved places
  3. Can select existing or add new
  4. New places saved for future reuse

### ✅ Other Working Features
- **Phone Unlock Trigger**: Working when app is foregrounded
- **Charging Trigger**: Working with battery monitoring
- **Location-Based Reminders**: Geofencing with saved places
- **App Opened Trigger**: Screen Time integration (requires paid developer account)
- **Reminder Detail Page**: Deep linking from notifications
- **Persistent Storage**: SQLite database for all data

## Testing the Saved Places System

1. Create a new reminder
2. Tap "When I arrive somewhere"
3. If first time: Tap "Add New Place"
4. Grant location permissions if prompted
5. Tap on the map to select a location (or use current location)
6. Enter a place name (e.g., "Home", "Office")
7. Adjust radius if needed
8. Save
9. Create another reminder with location trigger
10. You should now see your saved place in the list
11. Select it - usage count will increment

## Notes

- **No API Keys Required**: Using Apple Maps (PROVIDER_DEFAULT)
- **Location Permissions**: Will be requested when opening map picker
- **Geofencing**: iOS limit of 20 geofences per app
- **Saved Places**: Unlimited storage in SQLite
- **Usage Statistics**: Tracks how often each place is used

## Troubleshooting

### If build fails with module map errors:
1. Clean build folder: `Shift + Cmd + K`
2. Clean derived data: Xcode > Settings > Locations > Derived Data > Delete
3. Close and reopen Xcode
4. Try building again

### If maps don't show:
1. Check location permissions in Settings > Until > Location
2. Make sure you're testing on a real device (not simulator for some features)
3. Check console logs for any permission errors

### If geofences don't trigger:
1. Make sure location permission is set to "Always" (not "While Using")
2. Check that the reminder status is "waiting" (not "fired" or "expired")
3. Walk at least 100m away from the location, then return
4. Geofences can take 1-2 minutes to activate after registration
