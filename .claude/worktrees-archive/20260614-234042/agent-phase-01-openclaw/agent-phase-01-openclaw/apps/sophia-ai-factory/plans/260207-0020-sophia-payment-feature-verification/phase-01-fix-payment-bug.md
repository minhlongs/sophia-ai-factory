# Phase 1: Fix Payment Bug (CRITICAL - P0)

## Overview

- **Priority:** P0 CRITICAL
- **Status:** pending
- **Effort:** 15 minutes

## Problem

Double-lookup bug in `payment-service.ts` causes checkout to fail.

### Flow Analysis

```
1. Frontend sends: { tier: "BASIC" }
2. Route (line 14): getProductIdByTier("BASIC") → "prod_xxx" ✓
3. Route passes: { productId: "prod_xxx" } to service
4. Service (line 15): getProductIdByTier("prod_xxx") → undefined ✗
5. ERROR: "Polar Product ID not found for tier: prod_xxx"
```

## Root Cause

Service comment (lines 13-14) is WRONG:
```typescript
// productId in this context will be the Tier from the frontend (BASIC, PREMIUM, ENTERPRISE)
// We need to map it to the actual Polar Product ID
```

This is FALSE. The route ALREADY maps tier→productId before calling the service.

## Fix

**File:** `src/lib/services/real/payment-service.ts`

### Before (lines 10-19)

```typescript
async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
  const { productId, successUrl, customerEmail, metadata } = params;

  // productId in this context will be the Tier from the frontend (BASIC, PREMIUM, ENTERPRISE)
  // We need to map it to the actual Polar Product ID
  const polarProductId = getProductIdByTier(productId);

  if (!polarProductId) {
    throw new Error(`Polar Product ID not found for tier: ${productId}`);
  }
```

### After

```typescript
async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
  const { productId, successUrl, customerEmail, metadata } = params;

  // productId is ALREADY the Polar Product ID (mapped in route.ts via getProductIdByTier)
  // Do NOT call getProductIdByTier again here

  if (!productId) {
    throw new Error(`Missing Polar Product ID`);
  }
```

Also update line 23:
- Before: `products: [polarProductId],`
- After: `products: [productId],`

## Implementation Steps

1. [ ] Open `src/lib/services/real/payment-service.ts`
2. [ ] Remove import `getProductIdByTier` (line 3)
3. [ ] Replace lines 13-15 with corrected comment
4. [ ] Remove the `if (!polarProductId)` check, replace with simpler `if (!productId)` check
5. [ ] Change `products: [polarProductId]` to `products: [productId]`
6. [ ] Run `npm run build` to verify no TS errors
7. [ ] Test checkout locally

## Success Criteria

- Build passes with no errors
- Clicking "Get Started" redirects to Polar checkout (not 500 error)
- Console shows no "Polar Product ID not found" errors
