---
title: "Phase 02: Checkout Migration"
description: "Update payment-service, checkout routes, and one-time-checkout to use SDK createCheckout()"
status: pending
priority: P1
effort: 1h
phase: 02
depends_on: [01]
blocks: [04]
---

# Phase 02: Checkout Migration

## Overview

Replace `createInvoiceUrl()` and `createOneTimeInvoiceUrl()` calls with `createCheckout()` from the SDK wrapper. This switches from pre-created invoice redirects to API-created payments. The old functions are kept as `@deprecated` for emergency fallback.

## Key Insights

- **SDK `createCheckout()` does an API call** — previously synchronous URL building, now async. All callers must `await`.
- **Checkout now requires `NOWPAYMENTS_API_KEY`** — previously only IPN secret needed. The API key enables write access for invoice creation.
- **Order ID format unchanged** — `sophia_{userId}_{timestamp}` — keeps IPN handler compatibility.
- **Fallback strategy** — if SDK checkout fails (network error, API down), fall back to pre-created invoice URL for resilience.

## Architecture: Data Flow (New Checkout)

```
User selects tier
  → POST /api/checkout (tier, period, paymentMethod)
    → createCheckout({ tierId, userId, customerEmail })
      → sdk.createCheckout({ amount: 199, currency: 'USD', orderId: 'sophia_...', ... })
        → POST /v1/invoice (NOWPayments API)
          → returns { invoice_url, id (invoice_id) }
    → writeOrder(order_id, invoice_url, ...) to pending_orders
  → redirect user to invoice_url
```

## Files to Modify

| File | Action | Lines Changed |
|------|--------|---------------|
| `src/land/services/real/payment-service.ts` | Use `createCheckout()` instead of `createInvoiceUrl()` | ~10 |
| `src/app/api/checkout/route.ts` | Use `createCheckout()` in NOWPayments path (line 274) | ~15 |
| `src/app/api/payments/one-time-checkout/route.ts` | Use `createCheckout()` for one-time SKU | ~10 |
| `src/tree/clients/nowpayments-client.ts` | Deprecation annotations on old functions (already done in Phase 01) | 0 |

## Callers to Update

Every call site of `createInvoiceUrl()` and `createOneTimeInvoiceUrl()`:

1. **`src/land/services/real/payment-service.ts:20`** — `createInvoiceUrl(tierId, orgId)` → `await createCheckout({ tierId, userId: orgId })`
2. **`src/app/api/checkout/route.ts:60`** — GET handler: `createInvoiceUrl(mappedTier, userId)` → `await createCheckout({ tierId: mappedTier, userId })`
3. **`src/app/api/checkout/route.ts:274`** — POST handler NOWPayments path: `createInvoiceUrl(tier, userId)` → `await createCheckout({ tierId: tier, userId, customerEmail })`
4. **`src/app/api/payments/one-time-checkout/route.ts:122`** — `createOneTimeInvoiceUrl(sku, userId, email)` → `await createOneTimeCheckout({ skuId: sku.id, userId, customerEmail })`

## Implementation Steps

### Step 1: Add `createOneTimeCheckout()` to SDK wrapper
The one-time checkout needs a SKU-based wrapper in `nowpayments-client.ts`:

```typescript
export async function createOneTimeCheckout(input: {
  skuId: string
  userId: string
  customerEmail?: string
}): Promise<{ invoiceUrl: string; orderId: string; invoiceId: string }> {
  const sdk = createNowPaymentsSDK()
  const sku = getOneTimeSkuById(input.skuId)
  if (!sku) throw new Error(`Unknown SKU: ${input.skuId}`)
  // ... same pattern as createCheckout but uses sku.priceUsd
}
```

### Step 2: Update `payment-service.ts`
- Change `createInvoiceUrl(tierId, orgId)` → `await createCheckout({ tierId, userId: orgId })`
- Return `{ url: result.invoiceUrl, id: result.orderId }` (same shape, backward compat)
- Add try/catch with fallback to `createInvoiceUrl()` if SDK fails
- Log warning when falling back to pre-created invoice

### Step 3: Update `checkout/route.ts` GET handler (line 60)
- Change `createInvoiceUrl(mappedTier, userId)` → `await createCheckout({ tierId: mappedTier, userId })`
- Return redirect to `result.invoiceUrl`
- Fallback to pre-created URL on error

### Step 4: Update `checkout/route.ts` POST handler (line 274)
- Change `createInvoiceUrl(tier, userId)` → `await createCheckout({ tierId: tier, userId, customerEmail })`
- Store `result.invoiceUrl` in `writeOrder()` and return to client
- Still check `NOWPAYMENTS_TIERS[tier]` for tier validation (config still has tier keys)
- Fallback to pre-created URL on error with logged warning

### Step 5: Update `one-time-checkout/route.ts` (line 122)
- Change `createOneTimeInvoiceUrl(sku, userId, email)` → `await createOneTimeCheckout({ skuId: sku.id, userId, customerEmail })`
- Return `{ url: result.invoiceUrl, deduplicated: false }`
- Fallback to pre-created URL on error

### Step 6: Update test files
Tests to update (mock SDK instead of URL builder):

| Test File | What Changes |
|-----------|-------------|
| `src/tree/clients/__tests__/nowpayments-client.test.ts` | Phase 01 already covers SDK wrapper tests |
| `src/land/billing/__tests__/nowpayments-e2e-payment-lifecycle.test.ts` | Checkout simulation → mock SDK `createCheckout()` |
| `src/land/billing/__tests__/nowpayments-ipn-idempotency.test.ts` | May need order_id format unchanged |
| `src/land/billing/__tests__/ipn-subscription-lifecycle-contract.test.ts` | Tier config shape unchanged |

### Step 7: Run type-check + build
```bash
npm run type-check && npm run build
```
Must pass with 0 errors.

## Todo List

- [ ] Add `createOneTimeCheckout()` to SDK wrapper
- [ ] Update `payment-service.ts` — async `createCheckout()` with fallback
- [ ] Update `checkout/route.ts` GET — async `createCheckout()` with fallback
- [ ] Update `checkout/route.ts` POST NOWPayments path — async with fallback
- [ ] Update `one-time-checkout/route.ts` — async `createOneTimeCheckout()` with fallback
- [ ] Update affected test files (mock SDK instead of URL builder)
- [ ] Run `npm run type-check` — 0 errors
- [ ] Run `npm test` — all checkout-related tests pass

## Success Criteria

- `createCheckout()` is called (async API) instead of `createInvoiceUrl()` (sync URL builder)
- Checkout returns SDK-generated `invoice_url`
- On SDK failure, falls back to pre-created invoice URL (graceful degradation)
- `order_id` format unchanged: `sophia_{userId}_{timestamp}`
- `pending_orders` row written with correct `invoice_url`
- All checkout tests pass
- `npm run type-check` — 0 errors

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SDK API call fails (network) | Medium | High | Fallback to pre-created invoice URL with logged warning |
| `NOWPAYMENTS_API_KEY` not set | Medium | High | Runtime check throws; dev uses pre-created fallback |
| API latency slows checkout | Low | Medium | SDK call is a single POST; <2s expected |
| Invoice amount mismatch | Low | High | `TIER_PRICE_CONFIG` is source of truth; cross-check in IPN handler unchanged |
| Duplicate invoices from retry | Low | Medium | Existing dedupe logic in checkout route unchanged (24h window) |

## Security Considerations

- `NOWPAYMENTS_API_KEY` must be set as environment secret, never in client code
- `successUrl` and `cancelUrl` use `NEXT_PUBLIC_APP_URL` — validated to be our domain
- Order ID includes userId — this is intentional for IPN lookup, not a leak (userId is internal)

## Next Steps

- Phase 03 (Webhook Migration) — if already complete, proceed to Phase 04
- Phase 04 (Cleanup + Verify) — after both Phase 02 and 03 complete
