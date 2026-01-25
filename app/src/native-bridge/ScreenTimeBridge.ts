/**
 * React Native Bridge for ScreenTimeModule
 * Provides access to Apple's Family Controls framework
 */

import { NativeEventEmitter, NativeModules } from 'react-native';
import { AppOpenedEvent, SystemEventType } from '../domain';

console.log('[ScreenTimeBridge] Initializing...');

const { ScreenTimeModule } = NativeModules;

if (!ScreenTimeModule) {
  console.error('[ScreenTimeBridge] ❌ ScreenTimeModule not found!');
  console.error('[ScreenTimeBridge] Available modules:', Object.keys(NativeModules).join(', '));
} else {
  console.log('[ScreenTimeBridge] ✅ ScreenTimeModule loaded successfully');
  console.log('[ScreenTimeBridge] Available methods:', Object.keys(ScreenTimeModule).join(', '));
  console.log('[ScreenTimeBridge] Module type:', typeof ScreenTimeModule);
}

const screenTimeEmitter = ScreenTimeModule
  ? new NativeEventEmitter(ScreenTimeModule)
  : null;

// MARK: - Types

export type ScreenTimeAuthorizationStatus =
  | 'not_determined'
  | 'denied'
  | 'approved'
  | 'unknown';

export interface AppSelectionResult {
  selectedCount: number;
}

// MARK: - Authorization

/**
 * Request Family Controls authorization
 * Shows system permission dialog
 * @returns Authorization status after request
 */
export async function requestScreenTimePermission(): Promise<ScreenTimeAuthorizationStatus> {
  if (!ScreenTimeModule) {
    const error = new Error('ScreenTimeModule not available. Please build the app using Xcode.');
    console.error('[ScreenTimeBridge]', error.message);
    throw error;
  }

  try {
    const status = await ScreenTimeModule.requestScreenTimePermission();
    console.log('[ScreenTimeBridge] Authorization status:', status);
    return status;
  } catch (error) {
    console.error('[ScreenTimeBridge] Failed to request permission:', error);
    throw error;
  }
}

/**
 * Get current Family Controls authorization status
 */
export async function getScreenTimePermissionStatus(): Promise<ScreenTimeAuthorizationStatus> {
  if (!ScreenTimeModule) {
    return 'unknown';
  }

  try {
    return await ScreenTimeModule.getScreenTimePermissionStatus();
  } catch (error) {
    console.error('[ScreenTimeBridge] Failed to get permission status:', error);
    return 'unknown';
  }
}

/**
 * Subscribe to permission status changes
 */
export function subscribeToPermissionChanges(
  callback: (status: ScreenTimeAuthorizationStatus) => void
): () => void {
  if (!screenTimeEmitter) {
    console.warn('[ScreenTimeBridge] Event emitter not available');
    return () => {};
  }

  const subscription = screenTimeEmitter.addListener(
    'SCREEN_TIME_PERMISSION_CHANGED',
    (event: { status: ScreenTimeAuthorizationStatus }) => {
      console.log('[ScreenTimeBridge] Permission changed:', event.status);
      callback(event.status);
    }
  );

  return () => subscription.remove();
}

// MARK: - App Selection

/**
 * Present Apple's FamilyActivityPicker for app selection
 * User explicitly chooses which apps to monitor
 * @returns Object with count of selected apps
 */
export async function presentAppPicker(): Promise<AppSelectionResult> {
  if (!ScreenTimeModule) {
    throw new Error('ScreenTimeModule not available. Please build the app using Xcode to enable Screen Time features.');
  }

  try {
    const result = await ScreenTimeModule.presentAppPicker();
    console.log('[ScreenTimeBridge] App selection result:', result);
    return result;
  } catch (error: any) {
    console.error('[ScreenTimeBridge] Failed to present app picker:', error);
    
    // Handle user cancellation gracefully
    if (error.code === 'USER_CANCELLED' || error.message?.includes('cancelled')) {
      const cancelledError: any = new Error('User cancelled app selection');
      cancelledError.code = 'USER_CANCELLED';
      throw cancelledError;
    }
    
    throw error;
  }
}

/**
 * Check if user has selected any apps
 */
export async function hasSelectedApps(): Promise<boolean> {
  if (!ScreenTimeModule) {
    return false;
  }

  try {
    return await ScreenTimeModule.hasSelectedApps();
  } catch (error) {
    console.error('[ScreenTimeBridge] Failed to check selected apps:', error);
    return false;
  }
}

/**
 * Clear all selected apps
 */
export async function clearSelectedApps(): Promise<boolean> {
  if (!ScreenTimeModule) {
    return false;
  }

  try {
    return await ScreenTimeModule.clearSelectedApps();
  } catch (error) {
    console.error('[ScreenTimeBridge] Failed to clear selected apps:', error);
    return false;
  }
}

// MARK: - Event Subscription

/**
 * Subscribe to app opened events
 * Note: Requires DeviceActivity extension to be set up
 */
export function subscribeToAppOpened(
  callback: (event: AppOpenedEvent) => void
): () => void {
  if (!screenTimeEmitter) {
    console.warn('[ScreenTimeBridge] Event emitter not available');
    return () => {};
  }

  const subscription = screenTimeEmitter.addListener(
    'APP_OPENED',
    (nativeEvent: {
      timestamp: number;
      type: string;
      data: { appToken: string };
    }) => {
      console.log('[ScreenTimeBridge] App opened event:', nativeEvent);

      const event: AppOpenedEvent = {
        type: SystemEventType.APP_OPENED,
        timestamp: nativeEvent.timestamp,
        data: {
          bundleId: nativeEvent.data.appToken, // Store token as bundleId for now
        },
      };

      callback(event);
    }
  );

  return () => subscription.remove();
}
