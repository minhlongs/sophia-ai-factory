# Phase 06 — Unit Test Coverage (forest/worker, forest/raas, land/billing)

**Pillar:** C — Test Safety Net
**Status:** pending
**Priority:** P1
**Wave:** 2 (depends on Phase 05)

## Context Links
- Parent: `plans/260630-1626-zero-bug-three-pillars/plan.md`
- Phase 05: `phase-05-contract-tests.md`

## Overview

Target modules with critical gaps:
- `forest/worker/` — 32 files, 0 tests (BILLING RECONCILER — CRITICAL)
- `forest/raas/` — 12 files, 2 tests
- `land/billing/` — 52 files, 20 tests (need more coverage on payment flow)
- `land/payouts/` — 9 files, 3 tests

## Coverage Targets

| Module | Current | Target | Priority Files |
|--------|---------|--------|----------------|
| `forest/worker/` | 0% | ≥80% | billing reconciler, job scheduler, DLQ processor |
| `forest/raas/` | ~15% | ≥70% | gateway handler, request validator |
| `land/billing/` | ~30% | ≥70% | IPN handlers, subscription state machine |
| `land/payouts/` | ~25% | ≥70% | commission calculator, payout scheduler |

## Test Strategy

### forest/worker/ (32 files — start from ZERO)

1. **Billing reconciler** (`forest/worker/billing-reconciler.ts` or similar)
   - Mock D1, test reconciliation logic
   - Test: normal run, missing payments, double-count prevention

2. **Job scheduler** 
   - Test: cron schedule parsing, overlapping job prevention
   
3. **DLQ processor**
   - Test: retry logic, max attempts, permanent failure handling

### forest/raas/ (12 files → 2 tests)

4. **Gateway handler**
   - Mock external APIs, test request routing
   
5. **Request validator**
   - Test: valid/invalid requests, rate limiting

### land/billing/ (52 files → 20 tests)

6. **Subscription state machine**
   - Test: all state transitions, invalid transitions
   
7. **Payment verification**
   - Test: amount matching, underpayment detection

### land/payouts/ (9 files → 3 tests)

8. **Commission calculator**
   - Test: tier rates, minimum threshold, multi-level
   
9. **Payout scheduler**
   - Test: schedule logic, batch processing

## Implementation Steps

1. Scout `forest/worker/` structure — identify all 32 files and their functions
2. Write billing reconciler tests (highest priority — financial)
3. Write DLQ processor tests
4. Write job scheduler tests
5. Write remaining forest/worker tests
6. Write forest/raas tests
7. Write additional land/billing tests
8. Write additional land/payouts tests
9. Run `npm run test:coverage` — verify targets

## Success Criteria
- [ ] `forest/worker/` ≥ 80% coverage (from 0%)
- [ ] `forest/raas/` ≥ 70% coverage (from ~15%)
- [ ] `land/billing/` ≥ 70% coverage (from ~30%)
- [ ] `land/payouts/` ≥ 70% coverage (from ~25%)
- [ ] `npm test` → all pass (no regression)
- [ ] `npm run type-check` → 0 errors
- [ ] No mocking tricks — real logic tested
