/**
 * Secure Storage for payment entitlements
 * Uses expo-secure-store (iOS Keychain) instead of SQLite
 */

import * as SecureStore from 'expo-secure-store';
import { PaymentEntitlement } from '../domain';

const ENTITLEMENTS_KEY = 'until_entitlements';

const DEFAULT_ENTITLEMENTS: PaymentEntitlement = {
  hasProAccess: false,
  subscriptionActive: false,
};

/**
 * Save entitlements to secure storage (Keychain)
 */
export async function saveEntitlementsSecure(
  entitlements: PaymentEntitlement
): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      ENTITLEMENTS_KEY,
      JSON.stringify(entitlements)
    );
  } catch (error) {
    console.error('[SecureStorage] Failed to save entitlements:', error);
    throw error;
  }
}

/**
 * Load entitlements from secure storage (Keychain)
 */
export async function loadEntitlementsSecure(): Promise<PaymentEntitlement> {
  try {
    const raw = await SecureStore.getItemAsync(ENTITLEMENTS_KEY);
    if (!raw) return DEFAULT_ENTITLEMENTS;

    const parsed = JSON.parse(raw);
    return {
      hasProAccess: parsed.hasProAccess ?? false,
      subscriptionActive: parsed.subscriptionActive ?? false,
      productId: parsed.productId,
      purchaseDate: parsed.purchaseDate,
      expiryDate: parsed.expiryDate,
    };
  } catch (error) {
    console.error('[SecureStorage] Failed to load entitlements:', error);
    return DEFAULT_ENTITLEMENTS;
  }
}

/**
 * Clear entitlements from secure storage
 */
export async function clearEntitlementsSecure(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ENTITLEMENTS_KEY);
  } catch (error) {
    console.error('[SecureStorage] Failed to clear entitlements:', error);
  }
}
