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
  apps?: {
    type: 'app' | 'category' | 'webdomain';
    id: number;
  }[];
  appCount?: number;
  categoryCount?: number;
  webDomainCount?: number;
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
  console.log('[ScreenTimeBridge] presentAppPicker called');

  if (!ScreenTimeModule) {
    console.error('[ScreenTimeBridge] ScreenTimeModule is null/undefined!');
    throw new Error('ScreenTimeModule not available. Please build the app using Xcode to enable Screen Time features.');
  }

  console.log('[ScreenTimeBridge] ScreenTimeModule exists, checking presentAppPicker method...');
  console.log('[ScreenTimeBridge] presentAppPicker type:', typeof ScreenTimeModule.presentAppPicker);

  try {
    console.log('[ScreenTimeBridge] Calling ScreenTimeModule.presentAppPicker()...');
    const result = await ScreenTimeModule.presentAppPicker();
    console.log('[ScreenTimeBridge] App selection result:', result);
    return result;
  } catch (error: any) {
    console.error('[ScreenTimeBridge] Failed to present app picker:', error);
    console.error('[ScreenTimeBridge] Error code:', error.code);
    console.error('[ScreenTimeBridge] Error message:', error.message);

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
 * Start monitoring selected apps for usage
 * Requires DeviceActivity extension to be set up
 * @param activityName Unique activity name for this monitoring session (e.g., reminder ID)
 */
export async function startMonitoring(activityName: string): Promise<{ success: boolean; activityName?: string }> {
  if (!ScreenTimeModule) {
    console.error('[ScreenTimeBridge] Module not available');
    return { success: false };
  }

  try {
    const result = await ScreenTimeModule.startMonitoring(activityName);
    console.log('[ScreenTimeBridge] Monitoring started:', result);
    return { success: true, activityName: result.activityName };
  } catch (error) {
    console.error('[ScreenTimeBridge] Failed to start monitoring:', error);
    return { success: false };
  }
}

/**
 * Stop monitoring app usage
 */
export async function stopMonitoring(): Promise<boolean> {
  if (!ScreenTimeModule) {
    console.error('[ScreenTimeBridge] Module not available');
    return false;
  }

  try {
    await ScreenTimeModule.stopMonitoring();
    console.log('[ScreenTimeBridge] Monitoring stopped');
    return true;
  } catch (error) {
    console.error('[ScreenTimeBridge] Failed to stop monitoring:', error);
    return false;
  }
}

/**
 * Check if DeviceActivityMonitor extension is alive and working
 */
export async function checkExtensionStatus(): Promise<{
  alive: boolean;
  extensionAlive?: number;
  lastIntervalStart?: number;
  appGroupId?: string;
  activeActivities?: string[];
  error?: string;
}> {
  if (!ScreenTimeModule) {
    return { alive: false, error: 'ScreenTimeModule not available' };
  }

  try {
    const status = await ScreenTimeModule.checkExtensionStatus();
    console.log('[ScreenTimeBridge] Extension status:', status);
    return status;
  } catch (error) {
    console.error('[ScreenTimeBridge] Failed to check extension status:', error);
    return { alive: false, error: String(error) };
  }
}

/**
 * Check for new app opened events from the DeviceActivity extension
 * Returns null if no new events
 */
export async function checkForAppOpenedEvents(): Promise<{
  timestamp: number;
  appId: string;
  eventName: string;
  activityName: string;
  type: string;
} | null> {
  if (!ScreenTimeModule) {
    console.warn('[ScreenTimeBridge] ⚠️ Module not available for checking events');
    return null;
  }

  try {
    const event = await ScreenTimeModule.checkForAppOpenedEvents();
    if (event && typeof event === 'object') {
      console.log('[ScreenTimeBridge] ✅ App opened event detected from App Group!');
      console.log('[ScreenTimeBridge] Event details:', JSON.stringify(event, null, 2));

      // Validate event structure
      if (!event.appId) {
        console.error('[ScreenTimeBridge] ❌ Event missing appId field!');
      }
      if (!event.timestamp) {
        console.error('[ScreenTimeBridge] ❌ Event missing timestamp field!');
      }

      return event as any;
    }
    return null;
  } catch (error: any) {
    console.error('[ScreenTimeBridge] ❌ Failed to check for events:', error);
    console.error('[ScreenTimeBridge] Error type:', error?.constructor?.name);
    console.error('[ScreenTimeBridge] Error message:', error?.message);
    console.error('[ScreenTimeBridge] This may indicate App Group communication failure');
    return null;
  }
}

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

// MARK: - Global App Library

/**
 * Add apps from FamilyActivityPicker to the global app library
 * @param appIds Array of unique app IDs (e.g., ["app_instagram", "app_twitter"])
 * @returns Success boolean
 */
export async function addAppsToLibrary(appIds: string[]): Promise<boolean> {
  if (!ScreenTimeModule) {
    console.error('[ScreenTimeBridge] Module not available');
    return false;
  }

  try {
    console.log('[ScreenTimeBridge] Adding apps to library:', appIds);
    await ScreenTimeModule.addAppsToLibrary(appIds);
    console.log('[ScreenTimeBridge] Apps added successfully');
    return true;
  } catch (error) {
    console.error('[ScreenTimeBridge] Failed to add apps to library:', error);
    return false;
  }
}

/**
 * Remove an app from the global library
 */
export async function removeAppFromLibrary(appId: string): Promise<boolean> {
  if (!ScreenTimeModule) {
    console.error('[ScreenTimeBridge] Module not available');
    return false;
  }

  try {
    console.log('[ScreenTimeBridge] Removing app from library:', appId);
    await ScreenTimeModule.removeAppFromLibrary(appId);
    console.log('[ScreenTimeBridge] App removed successfully');
    return true;
  } catch (error) {
    console.error('[ScreenTimeBridge] Failed to remove app from library:', error);
    return false;
  }
}

/**
 * Start global app monitoring
 * Monitors ALL apps in the global library with one event per app
 */
export async function startGlobalAppMonitoring(): Promise<boolean> {
  if (!ScreenTimeModule) {
    console.error('[ScreenTimeBridge] Module not available');
    return false;
  }

  try {
    console.log('[ScreenTimeBridge] Starting global app monitoring...');
    await ScreenTimeModule.startGlobalAppMonitoring();
    console.log('[ScreenTimeBridge] Global app monitoring started');
    return true;
  } catch (error) {
    console.error('[ScreenTimeBridge] Failed to start global app monitoring:', error);
    return false;
  }
}

/**
 * Stop global app monitoring
 */
export async function stopGlobalAppMonitoring(): Promise<boolean> {
  if (!ScreenTimeModule) {
    console.error('[ScreenTimeBridge] Module not available');
    return false;
  }

  try {
    console.log('[ScreenTimeBridge] Stopping global app monitoring...');
    await ScreenTimeModule.stopGlobalAppMonitoring();
    console.log('[ScreenTimeBridge] Global app monitoring stopped');
    return true;
  } catch (error) {
    console.error('[ScreenTimeBridge] Failed to stop global app monitoring:', error);
    return false;
  }
}

/**
 * Get the count of apps in the global library
 */
export async function getGlobalAppCount(): Promise<number> {
  if (!ScreenTimeModule) {
    console.error('[ScreenTimeBridge] Module not available');
    return 0;
  }

  try {
    const count = await ScreenTimeModule.getGlobalAppCount();
    console.log('[ScreenTimeBridge] Global app count:', count);
    return count;
  } catch (error) {
    console.error('[ScreenTimeBridge] Failed to get global app count:', error);
    return 0;
  }
}
