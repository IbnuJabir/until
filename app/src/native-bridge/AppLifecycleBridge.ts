/**
 * React Native Bridge for AppLifecycleModule
 * Includes event queue to prevent missed early events before JS listeners attach
 */

import { NativeEventEmitter, NativeModules } from 'react-native';
import { SystemEvent, SystemEventType } from '../domain';

if (__DEV__) {
  console.log('[AppLifecycleBridge] Available native modules:', Object.keys(NativeModules));
}

const { AppLifecycleModule } = NativeModules;

if (!AppLifecycleModule) {
  if (__DEV__) {
    console.error('[AppLifecycleBridge] AppLifecycleModule not found!');
    console.error('[AppLifecycleBridge] Available modules:', Object.keys(NativeModules).join(', '));
  }
} else {
  if (__DEV__) {
    console.log('[AppLifecycleBridge] AppLifecycleModule loaded successfully');
  }
}

const appLifecycleEmitter = AppLifecycleModule
  ? new NativeEventEmitter(AppLifecycleModule)
  : null;

// Event queue to buffer early events before JS listeners subscribe
let eventQueue: SystemEvent[] = [];
let hasSubscriber = false;

// Start buffering events immediately on module load
if (appLifecycleEmitter) {
  appLifecycleEmitter.addListener(
    'APP_BECAME_ACTIVE',
    (nativeEvent: { timestamp: number; type: string }) => {
      const event: SystemEvent = {
        type: SystemEventType.APP_BECAME_ACTIVE,
        timestamp: nativeEvent.timestamp,
      };

      if (!hasSubscriber) {
        // Buffer the event until a subscriber is registered
        eventQueue.push(event);
        if (__DEV__) {
          console.log('[AppLifecycleBridge] Buffered early event (no subscriber yet)');
        }
      }
    }
  );
}

/**
 * Subscribe to app became active events
 * Replays any buffered events that occurred before subscription
 */
export function subscribeToAppBecameActive(
  callback: (event: SystemEvent) => void
): () => void {
  if (!appLifecycleEmitter) {
    if (__DEV__) {
      console.warn('[AppLifecycleBridge] Event emitter not available');
    }
    return () => {};
  }

  hasSubscriber = true;

  // Replay any buffered events
  if (eventQueue.length > 0) {
    if (__DEV__) {
      console.log(`[AppLifecycleBridge] Replaying ${eventQueue.length} buffered event(s)`);
    }
    for (const event of eventQueue) {
      callback(event);
    }
    eventQueue = [];
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

  return () => {
    subscription.remove();
    hasSubscriber = false;
  };
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
