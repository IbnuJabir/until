import { useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@until_theme_preference';

export type ThemePreference = 'system' | 'light' | 'dark';

let cachedPreference: ThemePreference = 'system';
const listeners = new Set<(pref: ThemePreference) => void>();

/**
 * Load theme preference from storage
 */
async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const value = await AsyncStorage.getItem(THEME_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') {
      cachedPreference = value;
      return value;
    }
  } catch {}
  return 'system';
}

/**
 * Save theme preference to storage and notify listeners
 */
export async function setThemePreference(pref: ThemePreference): Promise<void> {
  cachedPreference = pref;
  await AsyncStorage.setItem(THEME_KEY, pref);
  listeners.forEach((cb) => cb(pref));
}

/**
 * Get current theme preference
 */
export function getThemePreference(): ThemePreference {
  return cachedPreference;
}

// Load preference on module init
loadThemePreference();

/**
 * Hook that returns the resolved color scheme based on user preference
 */
export function useColorScheme(): 'light' | 'dark' {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreference] = useState<ThemePreference>(cachedPreference);

  useEffect(() => {
    // Load saved preference
    loadThemePreference().then(setPreference);

    // Subscribe to preference changes
    const handler = (pref: ThemePreference) => setPreference(pref);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  if (preference === 'system') {
    return systemScheme ?? 'light';
  }
  return preference;
}
