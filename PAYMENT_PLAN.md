# Payment Integration Plan - Until iOS App

## Current State Analysis

### What Exists
- ✅ `react-native-iap` v14.6.3 installed in package.json
- ✅ `PaymentEntitlement` type defined in `app/src/domain/types.ts`
- ✅ Product IDs defined: `com.app.until.monthly`, `com.app.until.yearly`
- ✅ `FREE_TIER_LIMITS` defined (3 reminders, limited triggers)
- ✅ Secure storage for entitlements (`expo-secure-store` → iOS Keychain)
- ✅ SQLite fallback for entitlements
- ✅ Placeholder `paywall.tsx` with UI mockup
- ✅ `canAddMoreReminders()` in store (currently has bypass bug - fixed in PR #8)
- ✅ `updateEntitlements()` in store

### What's Missing
- ❌ IAP initialization and connection
- ❌ Product fetching from App Store
- ❌ Purchase flow implementation
- ❌ Receipt validation (server-side recommended)
- ❌ Subscription status checking
- ❌ Restore purchases functionality
- ❌ App Store Connect product setup
- ❌ Webhook for subscription events (optional but recommended)

---

## Architecture Decision: Server-Side vs Client-Only

### Option A: Client-Only Validation (Simpler)
```
User → App → App Store → Receipt → App validates locally
```
- **Pros**: No server needed, faster to implement
- **Cons**: Less secure (jailbreak bypass possible), no subscription lifecycle webhooks

### Option B: Server-Side Validation (Recommended)
```
User → App → App Store → Receipt → Your Server → Apple Servers → Verify → App
```
- **Pros**: Secure, handles subscription renewals/cancellations properly, webhook support
- **Cons**: Requires backend endpoint

### Recommendation
**Start with Client-Only, add server validation later.** For an MVP with subscriptions, client-side validation with `react-native-iap` is sufficient. Add server-side when you need:
- Cross-platform purchase sharing
- Subscription lifecycle management (renewal failures, grace periods)
- Fraud prevention at scale

---

## Implementation Plan

### Phase 1: App Store Connect Setup (Manual - You)
1. **Create In-App Purchases in App Store Connect**
   - Go to App Store Connect → Your App → In-App Purchases
   - Create two auto-renewable subscriptions:
     - `com.app.until.monthly` - $4.99/month
     - `com.app.until.yearly` - $39.99/year (or your preferred pricing)
   - Set up a Subscription Group (e.g., "Until Pro")
   - Configure localized pricing for all regions

2. **Configure App Store Connect**
   - Add Sandbox Test Account(s) for testing
   - Set up Subscription Grace Period (optional but recommended)
   - Enable App Store Server Notifications (for later server-side integration)

3. **Xcode Capabilities**
   - Open `ios/until.xcodeproj` or `ios/until.xcworkspace`
   - Add "In-App Purchase" capability under Signing & Capabilities
   - This creates/updates the entitlements file

### Phase 2: IAP Service Layer (Code)

**New file: `app/src/services/IAPService.ts`**

```typescript
/**
 * In-App Purchase Service
 * Handles all IAP operations with react-native-iap
 */

import {
  initConnection,
  endConnection,
  getProducts,
  requestPurchase,
  finishTransaction,
  getPurchaseHistory,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type ProductPurchase,
  type SubscriptionPurchase,
  type Product,
} from 'react-native-iap';
import { Platform } from 'react-native';
import { ProductId, PaymentEntitlement } from '../domain';
import { saveEntitlementsSecure } from '../storage/secureStorage';

const PRODUCT_IDS = [ProductId.MONTHLY, ProductId.YEARLY];

class IAPService {
  private connected = false;
  private purchaseUpdateSubscription: any = null;
  private purchaseErrorSubscription: any = null;

  /**
   * Initialize IAP connection - call on app startup
   */
  async init(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      console.log('[IAP] Skipping - not iOS');
      return false;
    }

    try {
      await initConnection();
      this.connected = true;
      console.log('[IAP] Connected to App Store');
      return true;
    } catch (error) {
      console.error('[IAP] Failed to connect:', error);
      return false;
    }
  }

  /**
   * Clean up - call on app shutdown
   */
  async cleanup(): Promise<void> {
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
    }
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
    }
    if (this.connected) {
      await endConnection();
      this.connected = false;
    }
  }

  /**
   * Fetch products from App Store
   */
  async getProducts(): Promise<Product[]> {
    if (!this.connected) {
      throw new Error('IAP not connected');
    }

    try {
      const products = await getProducts({ skus: PRODUCT_IDS });
      console.log('[IAP] Products fetched:', products.length);
      return products;
    } catch (error) {
      console.error('[IAP] Failed to fetch products:', error);
      throw error;
    }
  }

  /**
   * Request a purchase
   */
  async purchase(productId: ProductId): Promise<void> {
    if (!this.connected) {
      throw new Error('IAP not connected');
    }

    try {
      await requestPurchase({ sku: productId });
    } catch (error: any) {
      if (error.code === 'E_USER_CANCELLED') {
        console.log('[IAP] User cancelled purchase');
        return;
      }
      console.error('[IAP] Purchase failed:', error);
      throw error;
    }
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(): Promise<PaymentEntitlement> {
    if (!this.connected) {
      throw new Error('IAP not connected');
    }

    try {
      const purchases = await getAvailablePurchases();
      console.log('[IAP] Available purchases:', purchases.length);

      // Find active subscription
      const activeSubscription = purchases.find(
        (p) => PRODUCT_IDS.includes(p.productId as ProductId)
      );

      if (activeSubscription) {
        const entitlements = this.purchaseToEntitlement(activeSubscription);
        await saveEntitlementsSecure(entitlements);
        return entitlements;
      }

      return { hasProAccess: false, subscriptionActive: false };
    } catch (error) {
      console.error('[IAP] Failed to restore purchases:', error);
      throw error;
    }
  }

  /**
   * Set up purchase listeners - returns cleanup function
   */
  setupListeners(
    onPurchaseSuccess: (entitlements: PaymentEntitlement) => void,
    onPurchaseError: (error: Error) => void
  ): () => void {
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: ProductPurchase | SubscriptionPurchase) => {
        console.log('[IAP] Purchase updated:', purchase.productId);

        // Validate and finish transaction
        try {
          const entitlements = this.purchaseToEntitlement(purchase);
          await saveEntitlementsSecure(entitlements);
          await finishTransaction({ purchase, isConsumable: false });
          onPurchaseSuccess(entitlements);
        } catch (error) {
          console.error('[IAP] Failed to process purchase:', error);
          onPurchaseError(error as Error);
        }
      }
    );

    this.purchaseErrorSubscription = purchaseErrorListener((error) => {
      console.error('[IAP] Purchase error:', error);
      if (error.code !== 'E_USER_CANCELLED') {
        onPurchaseError(new Error(error.message));
      }
    });

    return () => {
      this.purchaseUpdateSubscription?.remove();
      this.purchaseErrorSubscription?.remove();
    };
  }

  /**
   * Convert purchase to entitlement
   */
  private purchaseToEntitlement(
    purchase: ProductPurchase | SubscriptionPurchase
  ): PaymentEntitlement {
    return {
      hasProAccess: true,
      subscriptionActive: true,
      productId: purchase.productId,
      purchaseDate: purchase.transactionDate,
      // For subscriptions, you'd parse the receipt to get expiry
      // For now, we trust the purchase exists = active
    };
  }
}

export const iapService = new IAPService();
```

### Phase 3: Update Paywall Screen

**Key changes to `app/paywall.tsx`:**

```typescript
import { useEffect, useState } from 'react';
import { iapService } from '@/app/src/services/IAPService';
import { useReminderStore } from '@/app/src/store/reminderStore';
import { ProductId } from '@/app/src/domain';
import type { Product } from 'react-native-iap';

export default function PaywallScreen() {
  const router = useRouter();
  const { updateEntitlements } = useReminderStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
    
    const cleanup = iapService.setupListeners(
      (entitlements) => {
        updateEntitlements(entitlements);
        setPurchasing(false);
        router.back(); // Success - dismiss paywall
      },
      (err) => {
        setError(err.message);
        setPurchasing(false);
      }
    );

    return cleanup;
  }, []);

  const loadProducts = async () => {
    try {
      const prods = await iapService.getProducts();
      setProducts(prods);
    } catch (err) {
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (productId: ProductId) => {
    setPurchasing(true);
    setError(null);
    try {
      await iapService.purchase(productId);
    } catch (err: any) {
      setError(err.message);
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const entitlements = await iapService.restorePurchases();
      if (entitlements.hasProAccess) {
        updateEntitlements(entitlements);
        router.back();
      } else {
        setError('No active subscription found');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ... rest of UI, using products for dynamic pricing
}
```

### Phase 4: Initialize IAP on App Start

**Update `app/_layout.tsx`:**

```typescript
import { iapService } from '@/app/src/services/IAPService';

// In RootLayout component:
useEffect(() => {
  // Initialize IAP
  iapService.init().then((connected) => {
    if (__DEV__) console.log('[App] IAP initialized:', connected);
  });

  return () => {
    iapService.cleanup();
  };
}, []);
```

### Phase 5: Check Subscription Status on App Launch

**Add to `app/src/store/reminderStore.ts` in `loadFromStorage`:**

```typescript
// After loading entitlements from secure storage, verify with App Store
// This catches expired subscriptions
const checkSubscriptionStatus = async () => {
  try {
    const purchases = await iapService.restorePurchases();
    set({ entitlements: purchases });
  } catch (error) {
    // Keep local entitlements if check fails (offline scenario)
    console.warn('[Store] Could not verify subscription status');
  }
};
```

---

## Testing Strategy

### Sandbox Testing
1. Create sandbox tester accounts in App Store Connect
2. Sign out of App Store on device
3. Sign in with sandbox account when prompted during purchase
4. Test:
   - Purchase monthly
   - Purchase yearly
   - Cancel and re-subscribe
   - Restore on fresh install
   - Offline behavior

### Test Scenarios
| Scenario | Expected Behavior |
|----------|-------------------|
| Fresh install, no purchase | Free tier (3 reminders, limited triggers) |
| Purchase monthly | Unlock Pro immediately |
| Close app, reopen | Pro status persists |
| Delete and reinstall | Restore recovers Pro |
| Subscription expires | Revert to free tier |
| Purchase while offline | Queue purchase, process when online |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `app/src/services/IAPService.ts` | **Create** - Core IAP logic |
| `app/paywall.tsx` | **Modify** - Connect to IAPService |
| `app/_layout.tsx` | **Modify** - Initialize IAP on start |
| `app/src/store/reminderStore.ts` | **Modify** - Verify subscription on load |
| `ios/until/until.entitlements` | **Modify** - Add In-App Purchase capability |

---

## Timeline Estimate

| Phase | Time |
|-------|------|
| App Store Connect setup | 1-2 hours (manual) |
| IAPService implementation | 2-3 hours |
| Paywall integration | 1-2 hours |
| App startup integration | 30 min |
| Testing & debugging | 2-4 hours |
| **Total** | **6-12 hours** |

---

## Security Notes

1. **Receipt validation**: `react-native-iap` v14+ handles basic receipt validation. For production, consider server-side validation.

2. **Keychain storage**: Entitlements are stored in iOS Keychain via `expo-secure-store` - this is secure.

3. **Offline handling**: App should gracefully degrade if it can't verify subscription (trust last known state).

4. **Jailbreak detection**: Optional - can add jailbreak detection to prevent local tampering.

---

## Questions for You

1. **Pricing**: Keep $4.99/month and $39.99/year ($3.33/mo)? Or different?

2. **Free trial**: 7 days as shown in mockup? Apple requires clear disclosure.

3. **Server-side validation**: Do you have a backend to add an endpoint? Or client-only for MVP?

4. **Introductory offers**: Want to add special pricing for first-time subscribers?

5. **Family Sharing**: Enable for subscriptions?

---

## Approval Checklist

- [ ] Pricing confirmed
- [ ] Free trial duration confirmed
- [ ] Server-side vs client-only decided
- [ ] App Store Connect setup completed
- [ ] Ready to implement

Once you approve this plan, I'll create the branch and implement the payment integration. ⚡️
