# Phase 02 — Track D: Refund Backend Implementation

**Priority:** P1 | **Status:** pending | **Effort:** 4h | **Depends On:** Phase 01

## Overview

Implement the refund processing backend. Wire NOWPayments refund API, subscription tier rollback, MCU credit clawback, and refund ledger. The frontend is 9.7K LOC and complete — this backend makes it functional.

## Key Insights

- `refund-repo.ts` currently only does CRUD — needs `processRefund()` function
- NOWPayments SDK (`@nowpaymentsio/nowpayments-sdk-nodejs`) is already integrated for checkout + IPN
- handleRefunded in `nowpayments-ipn-subscription.ts` handles IPN-initiated refunds — 2-way sync needed
- **Pattern:** Atomic lock via `payment_events` INSERT ON CONFLICT (same as IPN handler)
- **Pattern:** Result<T,E> from `@/seed/types/result`

## Implementation Steps

### Step 1: Create `src/land/refunds/refund-processor.ts` (new file)

```typescript
// processRefund(params: RefundProcessInput): Promise<Result<RefundProcessResult, RefundError>>
// 1. Atomic lock: INSERT INTO refund_events (event_id, ...) ON CONFLICT DO NOTHING
// 2. Call NOWPayments refund API (if crypto payment)
// 3. Roll back subscription tier (BASIC if no previous paid tier)
// 4. Claw back MCU credits (revert to tier base amount)
// 5. Write refund_ledger entry
// 6. Mark refund_requests row as 'refunded' with tx_hash
// 7. Release lock: UPDATE refund_events SET processed = 1
```

### Step 2: Extend `src/land/refunds/refund-repo.ts`

- Add `processRefundStatus()` — updates status to 'refunded' with tx_hash
- Add `createRefundLedgerEntry()` — writes audit trail
- Export new types: `RefundProcessInput`, `RefundProcessResult`

### Step 3: Update admin endpoints

- `src/app/api/admin/refunds/[id]/mark-refunded/route.ts` — call processRefund()
- Add Zod validation on input body

### Step 4: Integration with NOWPayments IPN

- Read `handleRefunded` in `nowpayments-ipn-subscription.ts`
- Ensure IPN-driven refunds and user-requested refunds don't conflict
- Both paths write to same refund_ledger

## Related Code Files

| File | Action | Description |
|------|--------|-------------|
| `src/land/refunds/refund-processor.ts` | CREATE | Core refund processing logic |
| `src/land/refunds/refund-repo.ts` | MODIFY | Add ledger writes, status transitions |
| `src/land/refunds/index.ts` | CREATE | Barrel export |
| `src/app/api/admin/refunds/[id]/mark-refunded/route.ts` | MODIFY | Wire processRefund() |
| `src/land/billing/nowpayments-ipn-subscription.ts` | READ | Verify 2-way sync |

## Todo List

- [ ] Create `refund-processor.ts` with atomic lock pattern
- [ ] Implement NOWPayments refund API call
- [ ] Implement tier rollback logic
- [ ] Implement MCU credit clawback
- [ ] Implement refund ledger entry
- [ ] Extend `refund-repo.ts` with new functions
- [ ] Update admin mark-refunded endpoint
- [ ] Verify contract tests from Phase 01 now PASS
- [ ] Run full test suite (6200+ tests, 0 regressions)

## Success Criteria

- [] All 10+ contract tests from Phase 01 now PASS
- [] `npm run build` → 0 TypeScript errors
- [] `npm test` → all tests pass, 0 regressions
- [] Refund flow: user submits form → admin approves → processRefund → ledger entry → tier rollback
- [] Idempotency: duplicate refund returns "already processed"
- [] Protected flows unchanged (NOWPayments IPN, Setup Wizard, Telegram Bot)

## Risk Assessment

- **Risk:** NOWPayments refund API requires API key permissions (refund scope)
- **Mitigation:** Check key permissions in Setup Wizard; document required scopes
- **Risk:** Crypto network fees make partial refunds lossy
- **Mitigation:** Log fees separately; don't deduct from user refund amount
- **Risk:** Tier rollback during active dunning state could create inconsistent state
- **Mitigation:** Read dunning state before rollback; skip if in dunning

## Next Steps

- Phase 09: Integration tests with all tracks
- Deploy + verify per CF-direct doctrine
