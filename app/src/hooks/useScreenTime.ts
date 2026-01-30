/**
 * useScreenTime - React hook for Screen Time API
 * Manages authorization and app selection flow
 */

import { useState, useEffect, useCallback } from 'react';
import {
  requestScreenTimePermission,
  getScreenTimePermissionStatus,
  presentAppPicker,
  hasSelectedApps,
  clearSelectedApps,
  subscribeToPermissionChanges,
  startMonitoring,
  stopMonitoring,
  ScreenTimeAuthorizationStatus,
  AppSelectionResult,
} from '../native-bridge/ScreenTimeBridge';

export interface UseScreenTimeResult {
  // Permission state
  authStatus: ScreenTimeAuthorizationStatus;
  isAuthorized: boolean;
  isLoading: boolean;

  // App selection state
  hasAppsSelected: boolean;

  // Actions
  requestPermission: () => Promise<ScreenTimeAuthorizationStatus>;
  showAppPicker: () => Promise<AppSelectionResult | null>;
  clearApps: () => Promise<void>;
  startMonitoring: (activityName: string) => Promise<{ success: boolean; activityName?: string }>;
  stopMonitoring: () => Promise<boolean>;

  // Error state
  error: string | null;
}

export function useScreenTime(): UseScreenTimeResult {
  const [authStatus, setAuthStatus] = useState<ScreenTimeAuthorizationStatus>('not_determined');
  const [hasAppsSelected, setHasAppsSelected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check initial authorization status and app selection
  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        const status = await getScreenTimePermissionStatus();
        setAuthStatus(status);

        // If status is 'unknown', the module is not available
        if (status === 'unknown') {
          setError('Screen Time module not available. Please build with Xcode.');
          setIsLoading(false);
          return;
        }

        if (status === 'approved') {
          const hasApps = await hasSelectedApps();
          setHasAppsSelected(hasApps);
        }
      } catch (err: any) {
        console.error('[useScreenTime] Failed to check initial status:', err);
        
        // If module is not available, set appropriate error
        if (err.message?.includes('not available') || err.message?.includes('ScreenTimeModule')) {
          setError('Screen Time module not available. Please build with Xcode.');
          setAuthStatus('unknown');
        } else {
          setError('Failed to check Screen Time status');
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkInitialStatus();
  }, []);

  // Subscribe to permission changes
  useEffect(() => {
    const unsubscribe = subscribeToPermissionChanges((status) => {
      console.log('[useScreenTime] Permission status changed:', status);
      setAuthStatus(status);

      // If permission was denied/revoked, clear app selection
      if (status !== 'approved') {
        setHasAppsSelected(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Request Screen Time permission
  const requestPermission = useCallback(async (): Promise<ScreenTimeAuthorizationStatus> => {
    setIsLoading(true);
    setError(null);

    try {
      // Add timeout protection to prevent stuck loading state
      const timeoutPromise = new Promise<ScreenTimeAuthorizationStatus>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Permission request timed out after 30 seconds. Please try again.'));
        }, 30000);
      });

      const status = await Promise.race([
        requestScreenTimePermission(),
        timeoutPromise
      ]);

      setAuthStatus(status);

      if (status !== 'approved') {
        setError('Screen Time permission not granted. Please grant permission in Settings.');
      }

      return status;
    } catch (err: any) {
      console.error('[useScreenTime] Failed to request permission:', err);
      setError(err.message || 'Failed to request Screen Time permission');
      return 'denied';
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Show app picker
  const showAppPicker = useCallback(async (): Promise<AppSelectionResult | null> => {
    // Check authorization first
    if (authStatus !== 'approved') {
      setError('Screen Time permission not granted. Please grant permission first.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Add timeout protection to prevent stuck loading state
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => {
          reject(new Error('App picker timed out after 30 seconds. Please try again.'));
        }, 30000);
      });

      const result = await Promise.race([
        presentAppPicker(),
        timeoutPromise
      ]);

      console.log('[useScreenTime] App selection complete:', result);

      // Update has apps selected state
      if (result && result.selectedCount > 0) {
        setHasAppsSelected(true);
      }

      return result;
    } catch (err: any) {
      console.error('[useScreenTime] Failed to show app picker:', err);

      // User cancelled is not really an error
      if (err.code === 'USER_CANCELLED') {
        return null;
      }

      setError(err.message || 'Failed to show app picker');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [authStatus]);

  // Clear selected apps
  const clearApps = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await clearSelectedApps();
      setHasAppsSelected(false);
    } catch (err: any) {
      console.error('[useScreenTime] Failed to clear apps:', err);
      setError(err.message || 'Failed to clear selected apps');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Start monitoring selected apps
  const startMonitoringApps = useCallback(async (activityName: string): Promise<{ success: boolean; activityName?: string }> => {
    try {
      const result = await startMonitoring(activityName);
      if (result.success) {
        console.log('[useScreenTime] Monitoring started successfully');
      } else {
        console.error('[useScreenTime] Failed to start monitoring');
        setError('Failed to start monitoring');
      }
      return result;
    } catch (err: any) {
      console.error('[useScreenTime] Failed to start monitoring:', err);
      setError(err.message || 'Failed to start monitoring');
      return { success: false };
    }
  }, []);

  // Stop monitoring
  const stopMonitoringApps = useCallback(async (): Promise<boolean> => {
    try {
      const success = await stopMonitoring();
      if (success) {
        console.log('[useScreenTime] Monitoring stopped successfully');
      }
      return success;
    } catch (err: any) {
      console.error('[useScreenTime] Failed to stop monitoring:', err);
      return false;
    }
  }, []);

  return {
    authStatus,
    isAuthorized: authStatus === 'approved',
    isLoading,
    hasAppsSelected,
    requestPermission,
    showAppPicker,
    clearApps,
    startMonitoring: startMonitoringApps,
    stopMonitoring: stopMonitoringApps,
    error,
  };
}
