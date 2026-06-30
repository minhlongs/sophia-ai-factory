# Phase 07 — Track A2: Self-Service Billing Portal Tests

**Priority:** P1 | **Status:** pending | **Effort:** 2h | **Depends On:** —

## Overview

Write contract tests for the self-service billing portal. The billing backend is sophisticated (dunning, IPN, emails, tier-change-provisioner) but the user-facing billing page is thin. Non-tech CEOs need to manage subscriptions in-app: see plan details, change tiers, view invoices, cancel/resubscribe.

**TDD approach:** Write tests proving the billing portal API responses — what the UI needs from the server to render plan details, invoice history, and action buttons.

## Key Insights

- Existing billing page: `src/app/[locale]/dashboard/billing/page.tsx` + components (charge-summary, payment-history, overage-table)
- `tier-change-provisioner.ts` (7,245 LOC) — handles tier upgrades/downgrades, but admin-triggered
- `subscription-expiry.ts` (1,990 LOC) — handles expiry, cancel, resubscribe
- `dunning/` (7 files) — comprehensive dunning automation
- **No user-triggered plan change or cancel flow** — all admin-only today
- **Pattern:** Server Actions for data mutations (preferred over API routes)

## Contract Tests to Write

### File: `src/app/[locale]/dashboard/billing/__tests__/billing-portal-api-contract.test.ts`

1. **GET subscription status returns plan name, price, next billing date** — User's current subscription details
2. **GET invoice history returns last 12 months** — Array of invoices with date, amount, status
3. **GET payment method returns masked NOWPayments address** — Don't expose full crypto address
4. **POST change-tier creates pending tier change** — Upgrade/downgrade with prorated calculation
5. **POST cancel-subscription creates cancellation with end-of-period date** — Not immediate cancel
6. **POST resubscribe after cancellation restores subscription** — Within grace period
7. **unauthenticated request returns 401** — Auth guard active
8. **change-tier below current tier returns prorated credit** — Downgrade refund calculation

### File: `src/land/billing/__tests__/tier-change-self-service-contract.test.ts`

1. **upgrade from BASIC to PREMIUM calculates correct prorated amount** — Mid-cycle upgrade math
2. **downgrade from PREMIUM to BASIC returns prorated credit** — Refund for unused days
3. **same-tier change returns error** — No-op rejected
4. **change during dunning returns error** — Blocked while payment failed
5. **concurrent tier changes only process one** — Atomic lock prevents double-charge

### File: `src/land/billing/__tests__/subscription-cancel-contract.test.ts`

1. **cancel sets end_date to current period end** — Not immediate termination
2. **resubscribe before end_date restores with same tier** — Grace period resubscribe
3. **resubscribe after end_date creates new subscription** — Fresh start
4. **cancel when not subscribed returns error** — No active subscription

## Related Code Files

| File | Action | Description |
|------|--------|-------------|
| `src/app/[locale]/dashboard/billing/__tests__/billing-portal-api-contract.test.ts` | CREATE | Portal API tests |
| `src/land/billing/__tests__/tier-change-self-service-contract.test.ts` | CREATE | Self-service tier change tests |
| `src/land/billing/__tests__/subscription-cancel-contract.test.ts` | CREATE | Cancel/resubscribe tests |
| `src/land/billing/tier-change-provisioner.ts` | READ | Understand current admin-tier change logic |
| `src/land/billing/subscription-expiry.ts` | READ | Understand cancel/expiry logic |

## Success Criteria

- [] 17+ contract tests written, all FAILING (backend not yet adapted for self-service)
- [] Tests prove tier change proration math
- [] Tests prove cancel/resubscribe lifecycle
- [] Tests prove atomic lock on concurrent tier changes
- [] No impact on existing test suite

## Risk Assessment

- **Risk:** Proration math may differ from admin-side tier-change-provisioner
- **Mitigation:** Reuse existing calculation functions; don't duplicate
- **Risk:** Cancel during active dunning could leave partial payment state
- **Mitigation:** Block cancel while dunning active; show "resolve payment first"

## Next Steps

- Phase 08: Self-service billing portal implementation (depends on these tests)
