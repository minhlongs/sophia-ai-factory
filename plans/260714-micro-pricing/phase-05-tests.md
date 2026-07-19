# Phase 5: Integration Tests

**Effort:** M (new test file + expand existing)
**Depends on:** Phase 4 (API deployed)

---

## Test Strategy

Follow existing test patterns in `land/billing/__tests__/`:
- `nowpayments-ipn-one-time.test.ts` — reference pattern for credit pack IPN tests
- `nowpayments-ipn-dispatch.test.ts` — routing tests
- `revenue-trust-integration.test.ts` — cross-module E2E

---

## New Test File

### `src/land/billing/__tests__/credit-pack-purchase.test.ts`

```typescript
/**
 * Integration tests for credit pack purchase → IPN → balance flow.
 *
 * Verifies:
 * 1. IPN for CREDIT_PACK_STARTER adds 10 credits
 * 2. IPN for CREDIT_PACK_STANDARD adds 50 credits
 * 3. IPN for CREDIT_PACK_POWER adds 200 credits
 * 4. Duplicate IPN (idempotent) does not double-add credits
 * 5. Refund zeros credits and revokes access
 * 6. Expired credits excluded from balance
 * 7. Feature flag gate: BASIC tier cannot purchase
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { handleOneTimeFinished, handleOneTimeRefunded } from '../nowpayments-ipn-one-time';
import { mockD1, resetD1 } from '../../../__tests__/helpers/mock-d1';

// Build minimal IPN payload for credit pack SKU
function makeCreditIpn(skuId: string, paymentId: string): NowPaymentsIpnPayloadLike {
  return {
    payment_id: paymentId,
    payment_status: 'finished',
    order_id: `credit_<SECRET_07b41e0c>$<SECRET_31ae9507>`,
    price_amount: 29,
    price_currency: 'USD',
    actually_paid: 29,
  };
}
```

Follow the pattern from `nowpayments-ipn-one-time.test.ts`:
- Mock D1 with in-memory tables matching schema
- Call `handleOneTimeFinished(ipn, sku)`
- Assert `credits_remaining` incremented by `sku.credits`
- Assert `user_purchases` row has `kind='one_time'`, `status='paid'`

---

## Expanded Tests

### `nowpayments-ipn-dispatch.test.ts`

Add 3 test cases:

```typescript
it('routes credit pack invoice to one-time handler', async () => {
  // Verify: invoiceId for CREDIT_PACK_STARTER → handleOneTimeFinished
});

it('credit pack IPN does not affect subscription state', async () => {
  // Verify: no subscriptions table changes on credit pack purchase
});
```

### `revenue-trust-integration.test.ts`

Add end-to-end scenario:

```typescript
it('full credit pack flow: purchase → spend → expiry', async () => {
  // 1. User buys CREDIT_PACK_STARTER (10 credits)
  // 2. Generates 3 videos (cost-guardrail deducts credits)
  // 3. Checks balance: 7 remaining
  // 4. Runs expiry cron → no-op (not expired)
  // 5. Fast-forwards time past expiry → cron marks expired
  // 6. Checks balance: 0 (all expired)
});
```

---

## Verification

1. `npm test -- land/billing/__tests__/credit-pack-purchase.test.ts` → all pass
2. `npm test -- land/billing/__tests__/nowpayments-ipn-dispatch.test.ts` → extend + pass
3. `npm test -- land/billing/__tests__/revenue-trust-integration.test.ts` → extend + pass
4. `npm run build` → 0 TS errors
5. `npm run lint` → 0 errors

---

## Protected Flow Regression

Run full billing test suite to confirm zero regression:

```bash
npm test -- land/billing/__tests__/
```

Expected: all existing tests pass + new tests pass.
