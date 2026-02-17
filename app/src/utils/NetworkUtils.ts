/**
 * Network connectivity utility
 * Provides basic connectivity detection for features that require network (e.g. speech recognition)
 */

/**
 * Check if the device has network connectivity
 * Uses a lightweight fetch to detect connectivity since @react-native-community/netinfo is not installed
 */
export async function checkNetworkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch('https://clients3.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok || response.status === 204;
  } catch {
    return false;
  }
}
