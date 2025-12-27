/**
 * React Native Bridge for BatteryModule
 */

import { NativeEventEmitter, NativeModules } from 'react-native';
import { ChargingEvent, SystemEventType } from '../domain';

const { BatteryModule } = NativeModules;

if (!BatteryModule) {
  console.warn('[BatteryBridge] Native module not found. Make sure iOS project is built.');
}

const batteryEmitter = BatteryModule
  ? new NativeEventEmitter(BatteryModule)
  : null;

export interface BatteryState {
  isCharging: boolean;
  batteryLevel: number;
  state: 'unknown' | 'unplugged' | 'charging' | 'full';
}

/**
 * Subscribe to charging state changes
 */
export function subscribeToChargingStateChanges(
  callback: (event: ChargingEvent) => void
): () => void {
  if (!batteryEmitter) {
    console.warn('[BatteryBridge] Event emitter not available');
    return () => {};
  }

  const subscription = batteryEmitter.addListener(
    'CHARGING_STATE_CHANGED',
    (nativeEvent: {
      timestamp: number;
      type: string;
      data: { isCharging: boolean; batteryLevel: number; state: string };
    }) => {
      const event: ChargingEvent = {
        type: SystemEventType.CHARGING_STATE_CHANGED,
        timestamp: nativeEvent.timestamp,
        data: {
          isCharging: nativeEvent.data.isCharging,
        },
      };
      callback(event);
    }
  );

  return () => subscription.remove();
}

/**
 * Get current battery state
 */
export async function getCurrentBatteryState(): Promise<BatteryState> {
  if (!BatteryModule) {
    return {
      isCharging: false,
      batteryLevel: 0,
      state: 'unknown',
    };
  }

  try {
    return await BatteryModule.getCurrentBatteryState();
  } catch (error) {
    console.error('[BatteryBridge] Failed to get battery state:', error);
    throw error;
  }
}

/**
 * Enable battery monitoring
 */
export async function enableBatteryMonitoring(): Promise<void> {
  if (!BatteryModule) {
    return;
  }

  try {
    await BatteryModule.enableBatteryMonitoring();
  } catch (error) {
    console.error('[BatteryBridge] Failed to enable battery monitoring:', error);
    throw error;
  }
}

/**
 * Disable battery monitoring
 */
export async function disableBatteryMonitoring(): Promise<void> {
  if (!BatteryModule) {
    return;
  }

  try {
    await BatteryModule.disableBatteryMonitoring();
  } catch (error) {
    console.error('[BatteryBridge] Failed to disable battery monitoring:', error);
    throw error;
  }
}
