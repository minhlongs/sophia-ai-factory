# Phase 02 — Fix TOCTOU Windows + Refund Idempotency

## Context Links
- Research: `research/code-audit-findings.md` (P1.1, P1.2)
- Plan: `plan.md`
- Contract tests: `phase-01-contract-tests.md`
- Key source: `src/land/billing/nowpayments-ipn-dispatch.ts:53-91` (TOCTOU in dispatchFinished)
- Key source: `src/land/billing/nowpayments-ipn-subscription.ts:571-611` (redundant refund check)
- Key source: `src/land/billing/nowpayments-ipn-handlers.ts:44-85` (atomic lock — reference pattern)
- Migration: `migrations/0002-payment-events.sql`

## Overview
- **Priority:** P1
- **Status:** pending (blocked by Phase 01)
- **Description:** Remove the two TOCTOU windows by eliminating SELECT-based dedup checks that run outside the atomic lock. The atomic lock in `processNowPaymentsIpn()` (INSERT ON CONFLICT DO NOTHING) is the single source of truth for idempotency.

## Key Insights

1. **The atomic lock IS sufficient**: `processNowPaymentsIpn()` at `handlers.ts:44-54` creates a unique `event_id` (`nowpayments_${payment_id}_${payment_status}`) via INSERT ON CONFLICT DO NOTHING. This guarantees exactly-once processing per (payment_id, status) pair.

2. **dispatchFinished dedup (TOCTOU #1)**: At `dispatch.ts:53-91`, the SELECT from `pending_orders` checking for same (userId, tier, status='completed') within 24h runs OUTSIDE the atomic lock. Two concurrent `finished` IPNs for the same user+tier with different `payment_id` values will both pass this check because neither has committed yet.

3. **handleRefunded redundant check (TOCTOU #2)**: At `subscription.ts:588-596`, the SELECT `WHERE event_id = 'nowpayments_${payment_id}_refunded' AND processed = 1` uses the same event_id format as the atomic lock. This check is redundant — if `handleRefunded` is called, the lock was already acquired. But because it's a separate SELECT outside the lock transaction, two concurrent refunds can both pass it.

4. **Fix strategy**: Remove redundant SELECT checks entirely. The atomic lock in `processNowPaymentsIpn` is the trust boundary. If additional dedup beyond event-level is needed (e.g., double-pay guard for same user+tier with different payment_ids), move that check INSIDE the atomic lock transaction.

## Requirements

### Functional
- F1: Remove SELECT-based dedup check in `dispatchFinished()` (lines 53-91 of dispatch.ts) — rely on atomic lock only
- F2: Remove SELECT-based redundant check in `handleRefunded()` (lines 588-596 of subscription.ts) — atomic lock is sufficient
- F3: (If needed) Move the double-pay guard (same user+tier within 24h) inside the atomic lock using a secondary UNIQUE constraint or a counter table in the same D1 batch
- F4: Zero regression on existing payment flow — all existing tests must still pass after fixes

### Non-Functional
- Zero `:any` types
- Canonical imports only
- `npm run build` — 0 TypeScript errors
- `npm test` — all tests pass

## Architecture

### Current Flow (with TOCTOU windows)

```
processNowPaymentsIpn()
  ├─ INSERT ... ON CONFLICT DO NOTHING  ← atomic lock ACQUIRED
  │
  ├─ dispatchFinished()
  │   ├─ lookupInvoice()                ← cold path (OK)
  │   ├─ SELECT pending_orders          ← TOCTOU WINDOW #1
  │   │   WHERE user_id, tier, status='completed', completed_at > cutoff
  │   │   (two concurrent calls both see no prior → both pass)
  │   └─ handleFinished()              ← subscription activation
  │
  ├─ dispatchRefunded()
  │   └─ handleRefunded()
  │       ├─ SELECT payment_events      ← TOCTOU WINDOW #2 (redundant)
  │       │   WHERE event_id = '..._refunded' AND processed = 1
  │       │   (two concurrent calls both see processed ≠ 1 → both pass)
  │       └─ UPDATE subscriptions       ← cancellation
  │
  └─ UPDATE payment_events SET processed=1  ← atomic lock RELEASED
```

### Target Flow (after fix)

```
processNowPaymentsIpn()
  ├─ INSERT ... ON CONFLICT DO NOTHING  ← atomic lock ACQUIRED
  │   (this IS the idempotency guarantee)
  │
  ├─ dispatchFinished()
  │   ├─ lookupInvoice()                ← cold path (OK)
  │   └─ handleFinished()              ← subscription activation
  │       (no SELECT dedup needed — lock prevents double-call)
  │
  ├─ dispatchRefunded()
  │   └─ handleRefunded()
  │       └─ UPDATE subscriptions       ← cancellation
  │           (no SELECT dedup needed — lock prevents double-call)
  │
  └─ UPDATE payment_events SET processed=1  ← atomic lock RELEASED
```

### Double-Pay Guard Strategy

The `dispatchFinished` dedup check (same user+tier within 24h) exists to prevent a scenario where a user creates two separate invoices for the same tier and pays both. This is a legitimate concern BUT:

1. The check as written is a best-effort guard (non-fatal — line 82: "better to double-process than silently drop")
2. The real fix is at INVOICE CREATION time (prevent duplicate invoices), not at IPN time
3. If we want to keep this guard, move it into the `handleFinished` flow where it runs under the atomic lock context

**Decision**: Remove the SELECT-based dedup in `dispatchFinished`. The comment at line 82-84 already acknowledges this is non-fatal. If double-pay prevention is needed, it belongs in invoice creation (tree/client layer), not in the IPN handler.

## Related Code Files

### Files to Modify
- `src/land/billing/nowpayments-ipn-dispatch.ts` — Remove lines 53-91 (SELECT dedup check in dispatchFinished)
- `src/land/billing/nowpayments-ipn-subscription.ts` — Remove lines 584-597 (redundant refund SELECT check)

### Files to Create
- None (modify existing only)

## Implementation Steps

### Step 1: Fix dispatchFinished TOCTOU
1. Open `src/land/billing/nowpayments-ipn-dispatch.ts`
2. Remove the dedup check block at lines 53-91 (the `if (userId && lookup.tier)` block with SELECT from `pending_orders`)
3. The `logger.info('[IPNDispatch] Routing to subscription handler', ...)` and `await throwOnError(handleFinished(ipn))` at lines 93-94 become the direct path after the `if (lookup.kind === 'one_time')` branch
4. Remove the now-unused import: `getDb` is only used in the dedup block (verify before removing)
5. Verify `parseUserIdFromOrderId` is still imported (may become unused)

### Step 2: Fix handleRefunded Redundant Check
1. Open `src/land/billing/nowpayments-ipn-subscription.ts`
2. Remove lines 584-597:
   - The comment block "Refund idempotency guard"
   - The `const refundEventId =` definition
   - The `const existing = await db.prepare(...)` SELECT
   - The `if (existing && existing.processed === 1)` early return
3. Keep the rest of `handleRefunded` intact (userId parsing, membership lookup, subscription cancellation, license cache invalidation)

### Step 3: Clean Up Imports
1. In `dispatch.ts`: Check if `getDb` import from `nowpayments-ipn-db` is still needed. If only used in dedup block, remove it.
2. In `dispatch.ts`: Check if `parseUserIdFromOrderId` import is still needed. If only used in dedup block, remove it.
3. In `subscription.ts`: Check if `getDb` import from `nowpayments-ipn-db` is still used outside `handleRefunded` (it is — by `handleFinished` and `handleFailed`). Keep it.

### Step 4: Verify
1. Run contract tests from Phase 01 — TOCTOU tests should now PASS
2. Run existing tests: `npm test` — all must pass
3. Run type check: `npm run type-check` — 0 errors
4. Run build: `npm run build` — 0 errors

## Todo List
- [ ] Remove dedup SELECT block from `dispatchFinished()` (dispatch.ts:53-91)
- [ ] Remove unused imports from `dispatch.ts` if applicable
- [ ] Remove redundant refund SELECT check from `handleRefunded()` (subscription.ts:584-597)
- [ ] Verify `getDb` import still needed in subscription.ts
- [ ] Run contract tests (Phase 01) — confirm TOCTOU tests now PASS
- [ ] Run `npm test` — confirm all existing tests pass
- [ ] Run `npm run type-check` — 0 errors
- [ ] Run `npm run build` — 0 errors

## Success Criteria
- `dispatchFinished()` no longer contains SELECT-based dedup check
- `handleRefunded()` no longer contains SELECT-based idempotency check
- Contract tests from Phase 01 all pass
- All existing tests pass (`npm test`)
- `npm run build` exits 0
- `npm run type-check` exits 0
- Zero `:any` types introduced
- No banned imports introduced

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Removing double-pay guard allows duplicate tier activation | Low | High | Guard was non-fatal (comment says "proceed on failure"). Real fix is at invoice creation. Atomic lock still prevents duplicate IPN processing. |
| Removing refund SELECT check allows double-refund | Low | High | Atomic lock at `processNowPaymentsIpn` already blocks duplicate `event_id`. The SELECT was redundant, not additional protection. |
| Unused imports break build | Medium | Low | Verify with `npm run type-check` after removal |
| Existing tests break from handler signature changes | Low | Medium | Tests mock `dispatchFinished`/`handleRefunded` — only internal logic changes, not signatures |

## Security Considerations
- The atomic lock (`INSERT ON CONFLICT DO NOTHING`) is the security boundary for idempotency. Handler-level checks were defense-in-depth that introduced their own race conditions. Removing them simplifies the trust model: ONE lock, ONE truth.
- No new security surface introduced — we're removing code, not adding it.
- D1's UNIQUE constraint on `payment_events.event_id` is the enforcement mechanism.

## Next Steps
- Phase 03: DLQ overflow hardening (independent — can run in parallel with Phase 02)
- Phase 04: Integration tests — end-to-end IPN flow
