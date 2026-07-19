---
parent: ./plan.md
status: completed
priority: P1
effort: 45m
---

# Phase 2: Update Code

## Context
- [Parent Plan](./plan.md)
- [Phase 1](./phase-01-create-polar-products.md) must complete first

## Overview

Update codebase to use single subscription products instead of bundle.

## Files to Modify

### 1. `src/lib/polar-config.ts`
**Changes:**
- Remove one-time products
- Remove monthly maintenance products
- Add new subscription products
- Simplify `getProductIdByTier()` to return subscription product ID

```typescript
// NEW: Single subscription products only
export const getPolarProductsSubscription = (): PolarProductDefinition[] => [
  {
    name: 'Sophia AI Factory - Starter',
    description: 'Complete AI video automation. 12-month commitment.',
    tier: 'BASIC',
    billingType: 'subscription',
    productId: getEnv('POLAR_PRODUCT_ID_STARTER_SUB'),
    prices: [{ amountType: 'fixed', priceAmount: 19900, priceCurrency: 'usd' }],
  },
  // Growth: $399/mo, Premium: $799/mo
];

export const getProductIdByTier = (tier: string): string | undefined => {
  const products = getPolarProductsSubscription();
  return products.find(p => p.tier === tier)?.productId;
};
```

### 2. `src/components/pricing-section.tsx`
**Changes:**
- Remove `setupPrice` and `maintenancePrice`
- Add single `price` field (in cents)
- Update UI to show "$X/month" with commitment note
- Simplify PricingCard props

```typescript
const PRICING_TIERS = [
  {
    name: "Starter",
    tier: "BASIC",
    price: 19900, // $199/mo
    features: [...],
  },
  // Growth: $399, Premium: $799
];
```

### 3. `src/app/api/checkout/route.ts`
**Changes:**
- Remove multi-product logic
- Use single `productId` from `getProductIdByTier(tier)`
- Simplify request to payment service

### 4. `src/lib/services/types.ts`
**Changes:**
- Revert `productIds: string[]` back to `productId: string`

### 5. `src/lib/services/real/payment-service.ts`
**Changes:**
- Revert to single product: `products: [productId]`

## Implementation Steps

1. Update `polar-config.ts` with subscription products
2. Simplify `pricing-section.tsx` UI
3. Simplify `checkout/route.ts`
4. Update `types.ts` interface
5. Update `payment-service.ts`
6. Update `mock/payment-service.ts`
7. Run `npm run build` to verify

## Todo

- [ ] Update polar-config.ts
- [ ] Update pricing-section.tsx
- [ ] Update checkout/route.ts
- [ ] Update types.ts
- [ ] Update real/payment-service.ts
- [ ] Update mock/payment-service.ts
- [ ] Build passes

## Success Criteria

- `npm run build` succeeds
- No TypeScript errors
- Code simplified from 6 products to 3
