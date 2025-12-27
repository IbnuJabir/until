/**
 * React Native Bridge for ScreenTimeModule
 * NOTE: This is a placeholder for future Screen Time API integration
 */

import { NativeEventEmitter, NativeModules } from 'react-native';
import { AppOpenedEvent, SystemEventType } from '../domain';

const { ScreenTimeModule } = NativeModules;

if (!ScreenTimeModule) {
  console.warn('[ScreenTimeBridge] Native module not found. This feature is planned for post-MVP.');
}

const screenTimeEmitter = ScreenTimeModule
  ? new NativeEventEmitter(ScreenTimeModule)
  : null;

/**
 * Subscribe to app opened events
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
      data: { bundleId: string; appName: string };
    }) => {
      const event: AppOpenedEvent = {
        type: SystemEventType.APP_OPENED,
        timestamp: nativeEvent.timestamp,
        data: {
          bundleId: nativeEvent.data.bundleId,
        },
      };
      callback(event);
    }
  );

  return () => subscription.remove();
}

/**
 * Request Screen Time permission
 */
export async function requestScreenTimePermission(): Promise<string> {
  if (!ScreenTimeModule) {
    throw new Error('ScreenTime feature not available yet');
  }

  try {
    return await ScreenTimeModule.requestScreenTimePermission();
  } catch (error) {
    // Expected error - not implemented yet
    throw new Error(
      'Screen Time API requires FamilyControls framework. Planned for post-MVP.'
    );
  }
}

/**
 * Get Screen Time permission status
 */
export async function getScreenTimePermissionStatus(): Promise<string> {
  if (!ScreenTimeModule) {
    return 'not_available';
  }

  try {
    return await ScreenTimeModule.getScreenTimePermissionStatus();
  } catch (error) {
    return 'not_available';
  }
}

/**
 * Select apps to monitor (opens system UI)
 */
export async function selectAppsToMonitor(): Promise<void> {
  if (!ScreenTimeModule) {
    throw new Error('ScreenTime feature not available yet');
  }

  try {
    await ScreenTimeModule.selectAppsToMonitor();
  } catch (error) {
    throw new Error(
      'App selection requires FamilyActivityPicker. Planned for post-MVP.'
    );
  }
}

/**
 * Start monitoring specific apps
 */
export async function startMonitoringApps(bundleIds: string[]): Promise<void> {
  if (!ScreenTimeModule) {
    throw new Error('ScreenTime feature not available yet');
  }

  try {
    await ScreenTimeModule.startMonitoringApps(bundleIds);
  } catch (error) {
    throw new Error(
      'App monitoring requires DeviceActivityMonitor extension. Planned for post-MVP.'
    );
  }
}

/**
 * Stop monitoring all apps
 */
export async function stopMonitoringApps(): Promise<void> {
  if (!ScreenTimeModule) {
    return;
  }

  try {
    await ScreenTimeModule.stopMonitoringApps();
  } catch (error) {
    console.error('[ScreenTimeBridge] Failed to stop monitoring:', error);
  }
}

/**
 * Get list of currently monitored apps
 */
export async function getMonitoredApps(): Promise<string[]> {
  if (!ScreenTimeModule) {
    return [];
  }

  try {
    return await ScreenTimeModule.getMonitoredApps();
  } catch (error) {
    console.error('[ScreenTimeBridge] Failed to get monitored apps:', error);
    return [];
  }
}
