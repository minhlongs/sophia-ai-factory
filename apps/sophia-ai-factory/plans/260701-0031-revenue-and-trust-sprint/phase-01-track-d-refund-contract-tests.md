# Phase 01 — Track D: Refund Backend Contract Tests

**Priority:** P1 | **Status:** pending | **Effort:** 2h | **Depends On:** —

## Overview

Write contract tests for the refund backend. Currently `src/land/refunds/refund-repo.ts` is a 111-line CRUD stub. The refund form UI is 9.7K LOC (`refund-form-client.tsx`) fully built. Without the backend, refund requests submitted via the form go nowhere. Track D completes the refund processing pipeline: NOWPayments refund API call, tier rollback, MCU clawback, refund ledger entry.

**TDD approach:** Write tests FIRST against the expected behavior, prove they fail (backend doesn't exist yet), then implement in Phase 02.

## Key Insights

- Refund form frontend: `src/app/[locale]/dashboard/billing/refund/` — complete UI
- Refund backend: `src/land/refunds/refund-repo.ts` — stub (CRUD only, no payment integration)
- Admin endpoints exist: `/api/admin/refunds/[id]`, `/api/admin/refunds/[id]/mark-refunded`
- handleRefunded in `nowpayments-ipn-subscription.ts` handles IPN-driven refunds — need to verify 2-way sync
- **Pattern:** Same atomic lock pattern as Payment Pipeline Hardening (INSERT ON CONFLICT DO NOTHING)
- **Pattern:** Result<T,E> from `@/seed/types/result`

## Requirements

### Functional
1. `processRefund()` function: calls NOWPayments refund API, rolls back tier, claws back MCU credits, writes refund ledger
2. Idempotency: duplicate refund requests for same purchase must return "already processed"
3. Refund ledger entry with audit trail (who requested, when approved, tx hash, amounts)
4. Integration with existing `refund-repo.ts` (createRefundRequest → admin approve → processRefund → mark refunded)

### Non-Functional
- Atomic lock on refund processing (prevents double-refund)
- Result<T,E> return type (no throwing)
- Logger for all audit-relevant operations
- Zod validation on refund request input

## Contract Tests to Write

### File: `src/land/refunds/__tests__/refund-processor-contract.test.ts`

1. **duplicate refund returns already-processed** — Two concurrent refunds for same purchase_id → second returns "already processed"
2. **refund creates ledger entry** — processRefund writes to refund_ledger with correct amounts
3. **refund rolls back tier** — After refund, user tier reverts to previous tier (or BASIC)
4. **refund claws back MCU credits** — After refund, MCU balance adjusts correctly
5. **invalid purchase_id returns error** — Non-existent purchase_id → Result failure with descriptive error
6. **NOWPayments API failure returns Result failure** — Mocked API error → doesn't mark as refunded

### File: `src/land/refunds/__tests__/refund-repo-contract.test.ts`

1. **createRefundRequest returns id** — Happy path creates row and returns UUID
2. **getRefundByPurchaseAndUser deduplicates** — Same purchase+user → returns existing request
3. **updateRefundStatus transitions** — pending→approved→refunded state machine works
4. **listPendingRefunds filters correctly** — Only returns pending status rows

## Related Code Files

| File | Action | Description |
|------|--------|-------------|
| `src/land/refunds/refund-repo.ts` | MODIFY | Extend with processRefund, ledger writes |
| `src/land/refunds/__tests__/refund-processor-contract.test.ts` | CREATE | Contract tests for refund processing |
| `src/land/refunds/__tests__/refund-repo-contract.test.ts` | CREATE | Contract tests for refund repo |
| `src/land/billing/nowpayments-ipn-subscription.ts` | READ | Verify handleRefunded integration |
| `src/app/[locale]/dashboard/billing/refund/` | READ | Understand frontend expectations |

## Success Criteria

- [] 10+ contract tests written, all FAILING (backend not yet implemented)
- [] Tests prove idempotency requirement (duplicate refund race condition)
- [] Tests prove audit trail requirement (ledger entry created)
- [] Tests prove tier rollback requirement
- [] No impact on existing test suite (all 6200+ tests still pass)

## Risk Assessment

- **Risk:** NOWPayments refund API may have limitations (network fees, settlement delays)
- **Mitigation:** Document assumptions in test comments; handle API unavailability gracefully
- **Risk:** Tier rollback logic may interact with dunning state
- **Mitigation:** Read dunning-workflow.ts before implementing rollback

## Next Steps

- Phase 02: Implement refund backend (depends on these tests)
- Phase 09: Integration tests across all tracks
