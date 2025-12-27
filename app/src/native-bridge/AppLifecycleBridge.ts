/**
 * React Native Bridge for AppLifecycleModule
 */

import { NativeEventEmitter, NativeModules } from 'react-native';
import { SystemEvent, SystemEventType } from '../domain';

const { AppLifecycleModule } = NativeModules;

if (!AppLifecycleModule) {
  console.warn('[AppLifecycleBridge] Native module not found. Make sure iOS project is built.');
}

const appLifecycleEmitter = AppLifecycleModule
  ? new NativeEventEmitter(AppLifecycleModule)
  : null;

/**
 * Subscribe to app became active events
 */
export function subscribeToAppBecameActive(
  callback: (event: SystemEvent) => void
): () => void {
  if (!appLifecycleEmitter) {
    console.warn('[AppLifecycleBridge] Event emitter not available');
    return () => {};
  }

  const subscription = appLifecycleEmitter.addListener(
    'APP_BECAME_ACTIVE',
    (nativeEvent: { timestamp: number; type: string }) => {
      const event: SystemEvent = {
        type: SystemEventType.APP_BECAME_ACTIVE,
        timestamp: nativeEvent.timestamp,
      };
      callback(event);
    }
  );

  return () => subscription.remove();
}

/**
 * Check if app is currently active
 */
export async function isAppActive(): Promise<boolean> {
  if (!AppLifecycleModule) {
    return false;
  }

  try {
    return await AppLifecycleModule.isAppActive();
  } catch (error) {
    console.error('[AppLifecycleBridge] Failed to check app active state:', error);
    return false;
  }
}
