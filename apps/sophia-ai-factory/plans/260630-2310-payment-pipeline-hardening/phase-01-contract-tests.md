# Phase 01 — Contract Tests: Prove Bugs Exist

## Context Links
- Research: `research/code-audit-findings.md`
- Plan: `plan.md`
- Key source: `src/land/billing/nowpayments-ipn-handlers.ts`
- Key source: `src/land/billing/nowpayments-ipn-dispatch.ts`
- Key source: `src/land/billing/nowpayments-ipn-subscription.ts`
- Key source: `src/land/billing/nowpayments-ipn-dead-letter.ts`
- Test pattern: `src/land/billing/__tests__/nowpayments-ipn-idempotency.test.ts`
- Mock factory: `src/land/billing/__tests__/d1-mock-factory.ts`
- Migration: `migrations/0002-payment-events.sql`

## Overview
- **Priority:** P1
- **Status:** pending
- **Description:** Write contract tests that prove the 3 vulnerabilities exist BEFORE any fixes are applied. This is TDD Step 1: red (failing tests).

## Key Insights

1. **Atomic lock EXISTS and works** (`handlers.ts:44-54`): The `INSERT ... ON CONFLICT DO NOTHING` pattern atomically acquires a lock. Tests must first prove this works correctly (preserve existing behavior).
2. **TOCTOU #1 — dispatchFinished dedup** (`dispatch.ts:60-69`): SELECT from `pending_orders` for duplicate check runs OUTSIDE the atomic lock. Two concurrent `finished` IPNs for same (userId, tier) within 24h can both pass the SELECT.
3. **TOCTOU #2 — handleRefunded redundant check** (`subscription.ts:588-596`): SELECT from `payment_events` AFTER the atomic lock already released. Redundant — the atomic lock already provides event-level dedup. This SELECT creates its own race window.
4. **DLQ silent drops** (`handlers.ts:173-182`): When `DLQ_SIZE_CAP=1000` is hit, events are silently dropped with no counter or recovery path.

## Requirements

### Functional
- F1: Test that `processNowPaymentsIpn()` atomic lock blocks duplicate `event_id` (already passing — verify preserved)
- F2: Test that `dispatchFinished()` dedup check has a TOCTOU window (two concurrent calls with same user+tier both pass)
- F3: Test that `handleRefunded()` redundant SELECT-based check can be raced (two concurrent refunds both pass the SELECT)
- F4: Test that DLQ silently drops events when at capacity (1000/1000) — prove no counter is incremented
- F5: Test that DLQ graduated thresholds log correct messages at 50% and 90%

### Non-Functional
- All tests use Vitest with `vi.mock()` — no real D1
- Mock patterns match existing `nowpayments-ipn-idempotency.test.ts` style
- Zero `:any` types in test files
- Tests must pass on current code (prove bugs exist with correct assertions)

## Architecture

### Data Flow for Contract Tests

```
Test injects IPN payload
  → processNowPaymentsIpn() (atomic lock via mock D1)
    → dispatchFinished() / dispatchRefunded() (TOCTOU window here)
      → handleRefunded() (redundant SELECT check here)
    → DLQ enqueue path (silent drop at capacity)
```

### Test Matrix

| Test | What It Proves | Current Behavior |
|------|---------------|-----------------|
| Atomic lock blocks duplicate event_id | Lock works | Already passing |
| dispatchFinished TOCTOU — concurrent same (user, tier) | Bug exists | Both pass (no rejection) |
| handleRefunded TOCTOU — concurrent same payment_id | Bug exists | Both pass (redundant check passable) |
| DLQ at capacity — event dropped | Bug exists | Silent drop, no counter |
| DLQ thresholds log correctly | Thresholds work | Already passing |

## Related Code Files

### Files to Create
- `src/land/billing/__tests__/ipn-toctou-contract.test.ts` — TOCTOU race condition contract tests (P1.1)
- `src/land/billing/__tests__/ipn-refund-idempotency-contract.test.ts` — Refund idempotency contract tests (P1.2)
- `src/land/billing/__tests__/ipn-dlq-overflow-contract.test.ts` — DLQ overflow contract tests (P1.5)

### Files to Modify
- None (test-only phase)

## Implementation Steps

### Step 1: TOCTOU Contract Test (`ipn-toctou-contract.test.ts`)
1. Mock D1 with `prepare()` pattern matching `buildMockDb()` in existing idempotency tests
2. Mock `dispatchFinished` to track call count per (userId, tier)
3. Test: Two concurrent `finished` IPNs with same (userId, tier) within 24h → both dispatch (prove TOCTOU)
4. Test: Atomic lock correctly blocks duplicate `event_id` (regression guard)
5. Test: Different `payment_id` but same (userId, tier) concurrently → both pass SELECT dedup (prove bug)
6. Use `vi.advanceTimersByTime` or parallel `Promise.all` to simulate concurrency

### Step 2: Refund Idempotency Contract Test (`ipn-refund-idempotency-contract.test.ts`)
1. Mock D1 to simulate the atomic lock path + handler-level SELECT
2. Test: Two concurrent `refunded` IPNs for same `payment_id` → prove SELECT check in `handleRefunded` can be raced
3. Test: Atomic lock alone (without handler check) correctly blocks duplicate refund
4. Test: Single refund processes correctly (regression guard)

### Step 3: DLQ Overflow Contract Test (`ipn-dlq-overflow-contract.test.ts`)
1. Mock D1 with `countUnresolvedDlq` returning 1000 (at capacity)
2. Test: Event at capacity → `processNowPaymentsIpn` returns `success: false` with "DLQ_OVERFLOW" message
3. Test: No counter is incremented for dropped events (prove missing tracking)
4. Test: 50% threshold logs at `logger.warn` level
5. Test: 90% threshold logs at `logger.error` level

## Todo List
- [ ] Create `ipn-toctou-contract.test.ts` with 5 test cases
- [ ] Create `ipn-refund-idempotency-contract.test.ts` with 3 test cases
- [ ] Create `ipn-dlq-overflow-contract.test.ts` with 4 test cases
- [ ] Run all contract tests — confirm TOCTOU tests FAIL (proving bugs)
- [ ] Run all contract tests — confirm DLQ overflow test shows silent drop
- [ ] Confirm all existing tests still pass (no regressions from test-only changes)

## Success Criteria
- 3 new test files exist with 12+ test cases total
- TOCTOU contract tests FAIL on current code (prove race windows exist)
- DLQ overflow contract test proves silent drop (no counter)
- All existing tests (`npm test`) still pass
- Zero `:any` types in new test files
- Test patterns match existing `d1-mock-factory.ts` conventions

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Mock D1 too complex to simulate concurrency | Medium | Low | Use `Promise.all` with same mock state; TOCTOU is about timing of SELECT vs INSERT |
| Tests pass when they should fail | Low | High | Review assertions carefully; run against current code to verify failure |
| Existing tests break from mock changes | Low | Medium | Isolate new mocks; do not modify `d1-mock-factory.ts` |

## Security Considerations
- Test IPN payloads use fake payment_ids (no real credentials)
- Mock D1 — no real database access
- No HMAC signature verification tested in this phase (handled by route.ts)

## Next Steps
- Phase 02: Fix TOCTOU windows + refund idempotency (tests should now pass)
- Phase 03: DLQ overflow hardening (tests should now pass)
