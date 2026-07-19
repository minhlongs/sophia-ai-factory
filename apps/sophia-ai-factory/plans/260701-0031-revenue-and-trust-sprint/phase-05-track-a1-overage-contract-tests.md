# Phase 05 — Track A1: Overage Billing Contract Tests

**Priority:** P1 | **Status:** pending | **Effort:** 3h | **Depends On:** —

## Overview

Write contract tests for overage billing. The usage metering pipeline is mature (43 files in `forest/usage-metering/`). Quota enforcement exists (`quota-enforcer.ts` returns 402/429 on hard block). Overage events are logged (`overage-logger-ops.ts` with `billable` flag). But there is **no automated "pay to continue" flow** — every hard block is lost revenue.

Track A1 builds the top-up flow: user hits quota → sees "buy more credits" prompt → pays via NOWPayments → credits added → quota re-check passes.

**TDD approach:** Write contract tests proving the top-up flow, payment idempotency, and credit reconciliation.

## Key Insights

- `overage-logger-ops.ts`: `logOverageEvent()`, `getOverageSummary()`, `markEventsAsBillable()` — buffer for high-throughput
- `quota-enforcer.ts`: `enforceQuota()` returns 429 with `quota_exceeded` code
- `quota-checker.ts`: `checkQuotaWithOverage()` — already tracks overage
- `video-production-cost-engine.ts`: cost modeling per video operation (MCU pricing exists)
- **No existing top-up flow** — this is net-new revenue capture
- **Pattern:** Same NOWPayments IPN → tier activation flow, but for credit top-ups (micro-transactions)
- **Pattern:** Result<T,E>, atomic lock, logger utility

## Contract Tests to Write

### File: `src/land/billing/__tests__/overage-topup-contract.test.ts`

1. **top-up creates invoice with correct MCU amount** — User buys 100 MCU → invoice created with 100 MCU
2. **top-up payment IPN adds credits to user balance** — IPN finished → credits reflected in quota
3. **duplicate top-up IPN returns already-processed** — Atomic lock prevents double-crediting
4. **top-up with insufficient payment amount rejected** — Paid $5 but price is $10 → no credits added
5. **top-up credits expire after billing period** — MCU credits reset on next billing cycle (configurable)

### File: `src/land/billing/__tests__/overage-reconciliation-contract.test.ts`

1. **events marked billable after successful top-up** — `markEventsAsBillable()` called with correct event IDs
2. **unbillable events excluded from billing summary** — `billable: false` events don't appear in invoice
3. **reconciliation matches overage events to invoices** — `getOverageSummary()` totals match invoice line items
4. **concurrent top-ups for same user don't double-count** — Atomic lock on credit addition

### File: `src/forest/quota/__tests__/quota-topup-contract.test.ts`

1. **quota check passes after successful top-up** — Credits added → quota check returns allowed
2. **quota check fails before top-up** — Credits exhausted → quota check returns 429
3. **warning threshold triggers at 80% usage** — Approaching limit → warning in response

## Related Code Files

| File | Action | Description |
|------|--------|-------------|
| `src/land/billing/__tests__/overage-topup-contract.test.ts` | CREATE | Top-up flow contract tests |
| `src/land/billing/__tests__/overage-reconciliation-contract.test.ts` | CREATE | Reconciliation contract tests |
| `src/forest/quota/__tests__/quota-topup-contract.test.ts` | CREATE | Quota+topup integration tests |
| `src/forest/quota/quota-enforcer.ts` | READ | Understand 429 response format |
| `src/forest/quota/overage-logger-ops.ts` | READ | Understand billable flag |
| `src/land/billing/nowpayments-ipn-handlers.ts` | READ | Extend for top-up IPN type |

## Success Criteria

- [] 12+ contract tests written, all FAILING (backend not yet implemented)
- [] Tests prove top-up idempotency (duplicate IPN → "already processed")
- [] Tests prove credit reconciliation (events → invoice line items match)
- [] Tests prove quota integration (credits added → quota check passes)
- [] No impact on existing test suite

## Risk Assessment

- **Risk:** NOWPayments crypto micro-transactions may have high network fees
- **Mitigation:** Set minimum top-up amount; display fee clearly to user
- **Risk:** Credit expiry logic may conflict with existing metering cache
- **Mitigation:** Invalidate quota cache after credit addition (same as IPN tier activation)

## Next Steps

- Phase 06: Overage billing implementation (depends on these tests)
