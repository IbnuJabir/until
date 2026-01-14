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
  requestPermission: () => Promise<void>;
  showAppPicker: () => Promise<AppSelectionResult | null>;
  clearApps: () => Promise<void>;

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

        if (status === 'approved') {
          const hasApps = await hasSelectedApps();
          setHasAppsSelected(hasApps);
        }
      } catch (err) {
        console.error('[useScreenTime] Failed to check initial status:', err);
        setError('Failed to check Screen Time status');
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
  const requestPermission = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const status = await requestScreenTimePermission();
      setAuthStatus(status);

      if (status !== 'approved') {
        setError('Screen Time permission not granted. Please grant permission in Settings.');
      }
    } catch (err: any) {
      console.error('[useScreenTime] Failed to request permission:', err);
      setError(err.message || 'Failed to request Screen Time permission');
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
      const result = await presentAppPicker();
      console.log('[useScreenTime] App selection complete:', result);

      // Update has apps selected state
      if (result.selectedCount > 0) {
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

  return {
    authStatus,
    isAuthorized: authStatus === 'approved',
    isLoading,
    hasAppsSelected,
    requestPermission,
    showAppPicker,
    clearApps,
    error,
  };
}
