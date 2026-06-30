# Phase 04 — Integration Tests: End-to-End IPN Flow

## Context Links
- Plan: `plan.md`
- Phase 01: `phase-01-contract-tests.md` (unit-level contract tests)
- Phase 02: `phase-02-toctou-fix.md` (TOCTOU fixes)
- Phase 03: `phase-03-dlq-hardening.md` (DLQ fixes)
- Key source: `src/app/api/webhooks/nowpayments/route.ts` (webhook entry point)
- Key source: `src/land/billing/nowpayments-ipn-handlers.ts` (atomic lock + dispatch)
- Existing integration test: `src/land/billing/__tests__/nowpayments-e2e-payment-lifecycle.test.ts`
- Existing integration test: `src/land/billing/__tests__/ipn-concurrent-processing-contract.test.ts`
- Mock factory: `src/land/billing/__tests__/d1-mock-factory.ts`

## Overview
- **Priority:** P1
- **Status:** pending (blocked by Phase 02, Phase 03)
- **Description:** End-to-end integration tests that verify the complete IPN flow from webhook entry to tier activation, including idempotency, concurrency, and DLQ overflow handling. Tests validate that Phase 02 and Phase 03 fixes work correctly in combination.

## Key Insights

1. **Integration scope**: Test from `POST /api/webhooks/nowpayments` → `processNowPaymentsIpn()` → dispatch → handler → DB writes. Mock only the external boundary (NOWPayments HTTP call, D1) — test the real internal pipeline.

2. **Existing e2e lifecycle test** (`nowpayments-e2e-payment-lifecycle.test.ts`) already covers the happy path. Phase 04 adds: concurrency stress, idempotency under load, DLQ overflow full flow, and refund idempotency end-to-end.

3. **Concurrent processing test** (`ipn-concurrent-processing-contract.test.ts`) may already exist — verify it tests the TOCTOU scenarios fixed in Phase 02. If not, extend it.

4. **Test strategy**: Use the existing `d1-mock-factory.ts` and `buildMockDb()` patterns. Simulate concurrency with `Promise.all`. Verify database state after concurrent operations.

## Requirements

### Functional
- E2E-1: Happy path — `finished` IPN activates subscription (preserve existing test)
- E2E-2: Idempotency — duplicate `finished` IPN does not double-activate (preserve existing test)
- E2E-3: Concurrency — 5 concurrent `finished` IPNs with different payment_ids for same user+tier → all process correctly, no double-activation
- E2E-4: Refund idempotency — 3 concurrent `refunded` IPNs for same payment_id → exactly one cancellation, others return idempotent response
- E2E-5: DLQ overflow — Fill DLQ to capacity, send new IPN → event recorded in `payment_events_dropped`, not silently lost
- E2E-6: DLQ replay — Admin replays dropped event → processes correctly
- E2E-7: Mixed status concurrency — concurrent `finished` + `refunded` for different payment_ids → both handled without race

### Non-Functional
- Tests use Vitest with `vi.mock()` for D1 bindings and NOWPayments client
- Max 5s per test case (performance)
- Zero `:any` types
- Tests independent — can run in any order

## Architecture

### Integration Test Boundary

```
┌─────────────────────────────────────────────────────────────┐
│ Integration Test Scope                                       │
│                                                              │
│  Test injects IPN payload → POST /api/webhooks/nowpayments  │
│    → parseIpnWebhook() (MOCKED: signature verification)     │
│    → ipnPayloadSchema.safeParse() (REAL Zod validation)     │
│    → processNowPaymentsIpn() (REAL — with mocked D1)        │
│      → atomic lock INSERT (MOCKED D1)                       │
│      → dispatchFinished/Refunded (REAL)                     │
│      → handleFinished/Refunded (REAL — with mocked D1)     │
│      → DLQ enqueue / drop record (REAL — with mocked D1)    │
│    → Response { received: true } or { error: ... }          │
│                                                              │
│  MOCKED: D1, NOWPayments signature verification, PostHog    │
│  REAL: All internal pipeline logic                          │
└─────────────────────────────────────────────────────────────┘
```

### D1 Mock Strategy

Use `d1-mock-factory.ts` `buildD1Mock()` with hooks:
- `onInsert` callback to simulate UNIQUE constraint on `payment_events.event_id`
- `selectSingleResult` for `isPaymentProcessed` / dedup checks
- `selectCountResult` for `countUnresolvedDlq`
- `insertLog` to track what was inserted for assertions

## Related Code Files

### Files to Create
- `src/land/billing/__tests__/ipn-integration-hardening.test.ts` — Combined integration tests

### Files to Modify
- None (test-only phase)

## Implementation Steps

### Step 1: Create Integration Test Suite
Create `src/land/billing/__tests__/ipn-integration-hardening.test.ts` with:

#### Test Group A: Concurrency Robustness (Phase 02 validation)
```typescript
describe('IPN concurrency robustness', () => {
  it('handles 5 concurrent finished IPNs for different payment_ids (same user+tier)', async () => {})
  it('handles 3 concurrent refunds for same payment_id — exactly one processes', async () => {})
  it('handles concurrent finished + refunded for different payment_ids', async () => {})
  it('handles concurrent finished + failed for same user', async () => {})
})
```

#### Test Group B: DLQ Overflow End-to-End (Phase 03 validation)
```typescript
describe('DLQ overflow end-to-end', () => {
  it('records dropped event when DLQ at capacity', async () => {})
  it('returns dropped+stale entries from reconciliation endpoint', async () => {})
  it('replays dropped event successfully', async () => {})
})
```

#### Test Group C: Full Lifecycle (Regression)
```typescript
describe('Full IPN lifecycle', () => {
  it('finished → activates subscription', async () => {})
  it('finished → refunded → cancels subscription', async () => {})
  it('duplicate finished → idempotent (no double activation)', async () => {})
})
```

### Step 2: Implement Concurrency Tests
1. Mock D1 with thread-safe insert tracking (Map-based, like `nowpayments-ipn-idempotency.test.ts`)
2. Mock `dispatchFinished` / `dispatchRefunded` with call counting
3. Use `await Promise.all([...])` for concurrent invocation
4. Assertions:
   - Concurrency A: All 5 calls return success, but `handleFinished` called exactly 5 times (different payment_ids)
   - Concurrency B: First refund processes, other 2 get "Already processed" idempotent response
   - Concurrency C: Both finished and refunded process (different payment_ids, no conflict)

### Step 3: Implement DLQ Overflow Tests
1. Mock `countUnresolvedDlq` to return 1000
2. Mock `enqueueDlqEntry` to track calls (should NOT be called when at capacity)
3. Mock dropped events table (Map or array)
4. Assertions:
   - Event is recorded in dropped events store
   - `enqueueDlqEntry` is NOT called
   - Response includes "DLQ at capacity … event recorded"

### Step 4: Implement Reconciliation + Replay Tests
1. Mock `payment_events_dropped` with 3 pre-loaded dropped entries
2. Mock `ipn_dead_letter_queue` with 2 stale unresolved entries
3. Call reconciliation endpoint → verify returned data matches
4. Call replay endpoint with a dropped `payment_id` → verify `processNowPaymentsIpn` called
5. Assertions:
   - Reconciliation returns correct counts
   - Replay returns success
   - Replayed event is removed from dropped table after success

### Step 5: Run Full Test Suite
```bash
npm test                                    # All tests including new ones
npx vitest run src/land/billing/__tests__/ipn-integration-hardening.test.ts
npm run type-check
npm run build
```

## Todo List
- [ ] Create `ipn-integration-hardening.test.ts` with 10 test cases across 3 groups
- [ ] Implement concurrency tests (Group A — 4 tests)
- [ ] Implement DLQ overflow tests (Group B — 3 tests)
- [ ] Implement full lifecycle tests (Group C — 3 tests)
- [ ] Run all new integration tests — all pass
- [ ] Run full test suite (`npm test`) — all pass
- [ ] Run `npm run type-check` — 0 errors
- [ ] Run `npm run build` — 0 errors

## Success Criteria
- 10 integration test cases passing
- Concurrency test: 5 concurrent finished IPNs with different payment_ids — all processed, no double-activation
- Refund concurrency test: 3 concurrent refunds for same payment_id — exactly 1 processes
- DLQ overflow test: dropped event recorded, not silently lost
- Reconciliation test: returns dropped + stale entries with correct stats
- Replay test: dropped event replays successfully
- All existing tests still pass
- `npm run build` exits 0
- Zero `:any` types in new test file

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Mock D1 not thread-safe for concurrency tests | Medium | Medium | Use Map-based store with synchronous operations. Vitest runs in single thread — `Promise.all` with same mock state is sufficient to simulate TOCTOU. |
| Test assertions too strict — break on minor refactors | Low | Low | Assert on observable behavior (call counts, response messages), not internal state. |
| Integration tests slow down test suite | Low | Low | Mock all external services. Tests should run in <5s each. |

## Security Considerations
- Integration tests use fake payment_ids, fake user IDs, fake invoice IDs
- No real credentials or API keys in test files
- Mock D1 — no real database access
- Signature verification mocked — test focuses on pipeline logic, not crypto

## Next Steps
- Deploy and verify with `npm run deploy:full`
- Run `npm run deploy:verify` health checks
- Update changelog: `docs/project-changelog.md`
