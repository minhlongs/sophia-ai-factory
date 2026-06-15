# Payment Flow Research Report

**Date:** 2026-02-07
**Investigator:** researcher-01
**Status:** CRITICAL BUG FOUND

---

## Summary

Found a critical bug in the payment service layer. The checkout flow has a **double-lookup issue** where `getProductIdByTier()` is called twice, causing the Polar checkout to fail when actual product IDs are used.

---

## Flow Trace

### 1. "Get Started" Button Location
**File:** `src/components/pricing-section.tsx` (line 68-78)

```tsx
<button onClick={() => onSelect(tier)}>
  {loading ? "Processing..." : "Get Started"}
</button>
```

### 2. Click Handler
**File:** `src/components/pricing-section.tsx` (line 110-131)

```tsx
const handleSelectTier = async (tier: string) => {
  const response = await fetch("/api/checkout", {
    method: "POST",
    body: JSON.stringify({ tier }), // Sends: { tier: "BASIC" | "PREMIUM" | "ENTERPRISE" }
  });
  // Redirects to data.url on success
};
```

### 3. API Route
**File:** `src/app/api/checkout/route.ts`

```tsx
// Line 14: Converts tier → product ID
finalProductId = getProductIdByTier(tier); // Returns env var like "prod_xxx"

// Line 34-36: Passes product ID to service
const checkout = await paymentService.createCheckoutSession({
  productId: finalProductId, // This IS a Polar product ID now
  // ...
});
```

### 4. Payment Service (BUG HERE)
**File:** `src/lib/services/real/payment-service.ts`

```tsx
async createCheckoutSession(params: CreateCheckoutParams) {
  const { productId, ... } = params;

  // BUG: productId is ALREADY a Polar product ID (e.g., "prod_xxx")
  // But this tries to look it up as if it's a tier!
  const polarProductId = getProductIdByTier(productId); // Returns undefined!

  if (!polarProductId) {
    throw new Error(`Polar Product ID not found for tier: ${productId}`);
  }
}
```

---

## Critical Issue

| Step | Expected | Actual |
|------|----------|--------|
| Route receives | tier="BASIC" | tier="BASIC" ✓ |
| Route looks up | productId="prod_xxx" | productId="prod_xxx" ✓ |
| Service receives | productId="prod_xxx" | productId="prod_xxx" ✓ |
| Service looks up | N/A (should use directly) | getProductIdByTier("prod_xxx") = undefined ✗ |

**Result:** `Error: Polar Product ID not found for tier: prod_xxx`

---

## Polar Product IDs

**Config File:** `src/lib/polar-config.ts`

| Tier | Env Variable | Price |
|------|-------------|-------|
| BASIC | `POLAR_PRODUCT_ID_STARTER` | $1,200 |
| PREMIUM | `POLAR_PRODUCT_ID_GROWTH` | $2,000 |
| ENTERPRISE | `POLAR_PRODUCT_ID_PREMIUM` | $3,000 |

**Note:** Env vars are read at runtime. If empty, products will have `productId: ""`.

---

## Metadata Passing

Metadata IS being passed correctly in route:
```tsx
metadata: {
  tier: tier || 'BASIC',
  userId: user?.id || '',
}
```

---

## Recommendations

### Fix Option 1: Remove double-lookup (RECOMMENDED)
In `src/lib/services/real/payment-service.ts`, use the productId directly:

```tsx
async createCheckoutSession(params: CreateCheckoutParams) {
  const { productId, successUrl, customerEmail, metadata } = params;

  // productId is already the Polar product ID from the route
  const checkout = await polar.checkouts.create({
    products: [productId], // Use directly, no lookup
    successUrl,
    customerEmail,
    metadata,
  });
}
```

### Fix Option 2: Pass tier to service instead
Change route to pass tier, let service do the lookup.

**Option 1 is simpler and maintains separation of concerns.**

---

## Files to Modify

1. **`src/lib/services/real/payment-service.ts`** - Remove `getProductIdByTier()` call, use productId directly

---

## Verification Checklist

- [ ] Fix applied to payment-service.ts
- [ ] Local test with mock service
- [ ] Verify env vars are set in production (Vercel)
- [ ] Test checkout flow end-to-end

---

## Unresolved Questions

1. Are the `POLAR_PRODUCT_ID_*` env vars actually set in Vercel production?
2. Is there a test/staging Polar product set for development?
