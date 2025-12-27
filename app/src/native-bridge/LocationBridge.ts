/**
 * React Native Bridge for LocationModule
 */

import { NativeEventEmitter, NativeModules } from 'react-native';
import { LocationEvent, SystemEventType } from '../domain';

const { LocationModule } = NativeModules;

if (!LocationModule) {
  console.warn('[LocationBridge] Native module not found. Make sure iOS project is built.');
}

const locationEmitter = LocationModule
  ? new NativeEventEmitter(LocationModule)
  : null;

export interface GeofenceRegion {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export interface CurrentLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export type LocationPermissionStatus =
  | 'not_determined'
  | 'restricted'
  | 'denied'
  | 'authorized_always'
  | 'authorized_when_in_use';

/**
 * Subscribe to region entered events
 */
export function subscribeToRegionEntered(
  callback: (event: LocationEvent) => void
): () => void {
  if (!locationEmitter) {
    console.warn('[LocationBridge] Event emitter not available');
    return () => {};
  }

  const subscription = locationEmitter.addListener(
    'LOCATION_REGION_ENTERED',
    (nativeEvent: {
      timestamp: number;
      type: string;
      data: {
        identifier: string;
        latitude: number;
        longitude: number;
        radius: number;
      };
    }) => {
      const event: LocationEvent = {
        type: SystemEventType.LOCATION_REGION_ENTERED,
        timestamp: nativeEvent.timestamp,
        data: {
          identifier: nativeEvent.data.identifier,
          latitude: nativeEvent.data.latitude,
          longitude: nativeEvent.data.longitude,
        },
      };
      callback(event);
    }
  );

  return () => subscription.remove();
}

/**
 * Request location permission
 */
export async function requestLocationPermission(): Promise<string> {
  if (!LocationModule) {
    throw new Error('LocationModule not available');
  }

  try {
    return await LocationModule.requestLocationPermission();
  } catch (error) {
    console.error('[LocationBridge] Failed to request permission:', error);
    throw error;
  }
}

/**
 * Get location permission status
 */
export async function getLocationPermissionStatus(): Promise<LocationPermissionStatus> {
  if (!LocationModule) {
    return 'not_determined';
  }

  try {
    return await LocationModule.getLocationPermissionStatus();
  } catch (error) {
    console.error('[LocationBridge] Failed to get permission status:', error);
    throw error;
  }
}

/**
 * Register a geofence
 */
export async function registerGeofence(
  identifier: string,
  latitude: number,
  longitude: number,
  radius: number
): Promise<GeofenceRegion> {
  if (!LocationModule) {
    throw new Error('LocationModule not available');
  }

  try {
    return await LocationModule.registerGeofence(
      identifier,
      latitude,
      longitude,
      radius
    );
  } catch (error) {
    console.error('[LocationBridge] Failed to register geofence:', error);
    throw error;
  }
}

/**
 * Unregister a geofence
 */
export async function unregisterGeofence(identifier: string): Promise<boolean> {
  if (!LocationModule) {
    throw new Error('LocationModule not available');
  }

  try {
    return await LocationModule.unregisterGeofence(identifier);
  } catch (error) {
    console.error('[LocationBridge] Failed to unregister geofence:', error);
    throw error;
  }
}

/**
 * Get all monitored regions
 */
export async function getMonitoredRegions(): Promise<{
  count: number;
  maxLimit: number;
  regions: GeofenceRegion[];
}> {
  if (!LocationModule) {
    return { count: 0, maxLimit: 20, regions: [] };
  }

  try {
    return await LocationModule.getMonitoredRegions();
  } catch (error) {
    console.error('[LocationBridge] Failed to get monitored regions:', error);
    throw error;
  }
}

/**
 * Get current location
 */
export async function getCurrentLocation(): Promise<CurrentLocation> {
  if (!LocationModule) {
    throw new Error('LocationModule not available');
  }

  try {
    return await LocationModule.getCurrentLocation();
  } catch (error) {
    console.error('[LocationBridge] Failed to get current location:', error);
    throw error;
  }
}
