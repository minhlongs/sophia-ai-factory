---
phase: 1
title: "A1-Annual Billing"
status: completed
effort: "Medium (2-3d)"
priority: P1
dependencies: []
track: A
---

# Phase 1: A1-Annual Billing

## Overview

Wire annual billing through the NOWPayments checkout flow. UNIFIED_TIERS has yearly prices and the pricing UI already shows an annual toggle. But NOWPayments client only has monthly prices — yearly checkouts would create monthly-priced invoices and get rejected by IPN amount-mismatch checks.

## Context

- `UNIFIED_TIERS` has `yearlyPrice` + `yearlySavingsPercent` — exists in seed/config
- Pricing card + checkout panel show annual toggle — exists
- Checkout API accepts `period=yearly` — exists
- NOWPayments client: `TIER_PRICE_CONFIG` = monthly only — **blocker**
- IPN handler: compares payment amount against tier price, rejects yearly amounts — **blocker**
- Pre-created invoice IDs (fallback path) = monthly only — **blocker**

## Related Code Files

- **Modify:** `src/tree/clients/nowpayments-client.ts` — Add `period` to `CreateCheckoutInput`; add yearly prices to `TIER_PRICE_CONFIG`
- **Modify:** `src/land/billing/nowpayments-ipn-subscription.ts` — Fix amount-mismatch to compare yearly × 12 when period=yearly
- **Modify:** `src/app/api/checkout/route.ts` — Pass `period` to `createCheckout()`
- **Modify:** `src/forest/components/pricing/pricing-card.tsx` — Dynamic `yearlySavingsPercent`
- **Modify:** `src/seed/config/tiers/tier-configs.ts` — Add yearly NOWPayments invoice IDs

## Implementation Steps

1. Add `period: 'monthly' | 'yearly'` to `CreateCheckoutInput` type in NOWPayments client
2. Add yearly prices to `TIER_PRICE_CONFIG`: BASIC $1990, PREMIUM $3990, ENTERPRISE $7990
3. Use yearly price in `createCheckout()` when period is yearly
4. Fix IPN amount check: compare against yearly × 12 when period is yearly
5. Pass period from checkout API route to createCheckout
6. Replace hardcoded 17% savings in pricing-card.tsx with dynamic `yearlySavingsPercent`
7. Test with NOWPayments sandbox

## Success Criteria

- [ ] Yearly checkout creates correctly-priced NOWPayments invoice
- [ ] IPN handler accepts yearly payment amounts
- [ ] Pricing card shows correct yearly savings percentage
- [ ] Annual toggle works end-to-end from pricing page → checkout → payment → tier activation
- [ ] All existing tests pass

## Risk Assessment

- NOWPayments sandbox access needed for testing price variations
- Existing yearly pending_orders (if any) have monthly invoices — manual activation needed
- IPN rejection for yearly checkouts created between now and fix — manual correction
