# Phase 03 — DLQ Overflow Prevention + Admin Reconciliation

## Context Links
- Research: `research/code-audit-findings.md` (P1.5)
- Plan: `plan.md`
- Contract tests: `phase-01-contract-tests.md`
- Key source: `src/land/billing/nowpayments-ipn-handlers.ts:133-204` (DLQ enqueue path + graduated thresholds)
- Key source: `src/land/billing/nowpayments-ipn-dead-letter.ts` (DLQ CRUD operations)
- Migration: `migrations/0002-payment-events.sql` (reference for schema pattern)
- Existing test: `src/land/billing/__tests__/nowpayments-dlq.test.ts`
- Existing test: `src/land/billing/__tests__/ipn-dlq-contract.test.ts`

## Overview
- **Priority:** P1
- **Status:** pending (blocked by Phase 01)
- **Description:** Eliminate silent DLQ drops by adding a `payment_events_dropped` counter table, an admin reconciliation API endpoint, and convert the 90% threshold from passive log to actionable alert. The 100% cap drop now records the event before rejecting.

## Key Insights

1. **Current state — silent drops**: At `handlers.ts:173-182`, when `unresolvedDlqCount >= DLQ_SIZE_CAP (1000)`, the event is rejected with `message: "DLQ at capacity … event dropped"` but no durable record of the drop exists. If the operator checks logs later, the event data is lost.

2. **Graduated thresholds already exist**: 50% → `logger.warn`, 90% → `logger.error`. These are correct but passive — no automated alerting path.

3. **DLQ has `event_id` UNIQUE constraint** (`dead-letter.ts:243`: `event_id TEXT PRIMARY KEY`). This prevents duplicate DLQ entries but the enqueue code at `handlers.ts:184-192` calls `enqueueDlqEntry` which does INSERT-then-UPDATE-on-conflict.

4. **Fix strategy**:
   - Add `payment_events_dropped` table for durable dropped-event record
   - Record drop BEFORE returning the rejection (so event data is preserved)
   - Add admin reconciliation endpoint: `GET /api/admin/dlq/reconciliation` — lists dropped + stale DLQ entries
   - Add admin retry endpoint: `POST /api/admin/dlq/replay` — replays a dropped event by payment_id

## Requirements

### Functional
- F1: When DLQ at capacity, record the dropped event in `payment_events_dropped` table before rejecting
- F2: New DB migration `migrations/XXXX-payment-events-dropped.sql` creating the counter table
- F3: Admin reconciliation endpoint: `GET /api/admin/dlq/reconciliation?since=<ISO>&limit=<N>` — returns dropped events + unresolved DLQ entries
- F4: Admin replay endpoint: `POST /api/admin/dlq/replay` — accepts `{ payment_id }`, replays the dropped event through the IPN handler
- F5: DLQ graduated thresholds unchanged (50% warn, 90% error, 100% drop+record)

### Non-Functional
- Zero `:any` types
- Zod validation on admin API inputs
- Canonical imports only
- Admin endpoints gated behind auth (Better Auth session + admin tier)
- `npm run build` — 0 TypeScript errors
- `npm test` — all tests pass

## Architecture

### New `payment_events_dropped` Table

```sql
CREATE TABLE IF NOT EXISTS payment_events_dropped (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  order_id TEXT DEFAULT '',
  payload TEXT DEFAULT '{}',
  failure_reason TEXT DEFAULT '',
  dlq_size_at_drop INTEGER NOT NULL,
  dropped_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payment_events_dropped_payment
  ON payment_events_dropped(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_dropped_at
  ON payment_events_dropped(dropped_at);
```

### Modified DLQ Overflow Path

```
handlers.ts: processNowPaymentsIpn() catch block
  │
  ├─ DLQ_SIZE_CAP check (unchanged)
  │
  ├─ IF at capacity (>= 1000):
  │   ├─ INSERT into payment_events_dropped  ← NEW: durable record
  │   │   (event_id, payment_id, status, order_id, payload, reason, dlq_size)
  │   ├─ logger.error('DLQ_OVERFLOW — event recorded as dropped')  ← updated message
  │   └─ return { success: false, message: 'DLQ at capacity; event recorded' }
  │
  └─ IF below capacity: enqueueDlqEntry() (unchanged)
```

### Admin Reconciliation API

```
GET /api/admin/dlq/reconciliation?since=2026-06-30T00:00:00Z&limit=50
  → Returns:
    {
      dropped: [...payment_events_dropped rows],
      staleDlq: [...unresolved DLQ entries older than since],
      dlqStats: { unresolved, dropped, capacity }
    }

POST /api/admin/dlq/replay
  Body: { payment_id: "pay_xxx" }
  → Looks up dropped event by payment_id
  → Calls processNowPaymentsIpn() with the stored payload
  → Returns { success, message }
```

### Route Location

Following existing patterns (cf. `src/app/api/webhooks/nowpayments/route.ts`), admin routes go in:
- `src/app/api/admin/dlq/reconciliation/route.ts`
- `src/app/api/admin/dlq/replay/route.ts`

### Auth Gate

Use existing Better Auth session pattern. The middleware at `src/middleware.ts` already gates `/dashboard/admin/*`. For API routes:
```typescript
import { getCurrentUser } from '@/seed/auth/better-auth-session'
// Verify user is admin before proceeding
```

## Related Code Files

### Files to Create
- `migrations/XXXX-payment-events-dropped.sql` — New table for dropped events
- `src/app/api/admin/dlq/reconciliation/route.ts` — Admin reconciliation GET endpoint
- `src/app/api/admin/dlq/replay/route.ts` — Admin replay POST endpoint
- `src/land/billing/nowpayments-ipn-dropped-events.ts` — `recordDroppedEvent()` + `getDroppedEvents()` helpers

### Files to Modify
- `src/land/billing/nowpayments-ipn-handlers.ts:173-182` — Add `recordDroppedEvent()` call before rejecting

## Implementation Steps

### Step 1: Create Migration
1. Find next migration number: `ls migrations/ | sort | tail -1`
2. Create `migrations/XXXX-payment-events-dropped.sql` with the CREATE TABLE + indexes (use schema from Architecture section)
3. Verify SQL syntax: `sqlite3 :memory: < migrations/XXXX-payment-events-dropped.sql`

### Step 2: Create Dropped Events Helper Module
1. Create `src/land/billing/nowpayments-ipn-dropped-events.ts`
2. Export `recordDroppedEvent()`:
   - Accepts db, eventId, paymentId, paymentStatus, orderId, payload, failureReason, dlqSize
   - INSERT into `payment_events_dropped` table
   - Returns `Result<void, IPNError>`
   - Non-throwing — failure to record drop is logged but not fatal
3. Export `getDroppedEvents()`:
   - Accepts db, since (ISO string), limit (number)
   - SELECT from `payment_events_dropped` WHERE dropped_at >= since
   - Returns `DeadLetterEntry[]` (reuse interface)
4. Zero `:any` types — use proper TypeScript interfaces

### Step 3: Modify DLQ Overflow Path
1. Open `src/land/billing/nowpayments-ipn-handlers.ts`
2. At line 173 (inside `if (unresolvedDlqCount >= DLQ_SIZE_CAP)`):
   - Before `logger.error`, call `await recordDroppedEvent(db, { eventId, payment_id, payment_status, orderId, payload, failureReason, dlqSize: unresolvedDlqCount })`
   - Wrap in try/catch — failure to record is non-fatal
   - Update log message to "DLQ_OVERFLOW — event recorded as dropped"
   - Update return message to "DLQ at capacity … event recorded"
3. Import `recordDroppedEvent` from the new helper module

### Step 4: Create Admin Reconciliation Endpoint
1. Create `src/app/api/admin/dlq/reconciliation/route.ts`
2. GET handler:
   - Auth guard: `getCurrentUser()` → verify admin role
   - Zod validate query params: `{ since: z.string().datetime().optional(), limit: z.coerce.number().min(1).max(200).default(50) }`
   - Call `getDroppedEvents()` + `getStaleDlqEntries()` + `countUnresolvedDlq()`
   - Return JSON with all three datasets
3. Zero `:any` types

### Step 5: Create Admin Replay Endpoint
1. Create `src/app/api/admin/dlq/replay/route.ts`
2. POST handler:
   - Auth guard: `getCurrentUser()` → verify admin role
   - Zod validate body: `{ payment_id: z.string().min(1) }`
   - Look up dropped event by `payment_id` from `payment_events_dropped`
   - Parse stored payload as `NowPaymentsIpnPayload`
   - Call `processNowPaymentsIpn(payload)`
   - Return result
3. Zero `:any` types

### Step 6: Verify
1. Run contract tests from Phase 01 — DLQ overflow tests should now PASS (drop is recorded)
2. Run existing DLQ tests: `npx vitest run src/land/billing/__tests__/nowpayments-dlq.test.ts`
3. Run full test suite: `npm test`
4. Run type check: `npm run type-check`
5. Run build: `npm run build`
6. Apply migration locally: `bash scripts/apply-migrations.sh`

## Todo List
- [ ] Create migration `XXXX-payment-events-dropped.sql`
- [ ] Create `nowpayments-ipn-dropped-events.ts` (recordDroppedEvent + getDroppedEvents)
- [ ] Modify `handlers.ts:173-182` — add `recordDroppedEvent()` before rejection
- [ ] Create `src/app/api/admin/dlq/reconciliation/route.ts`
- [ ] Create `src/app/api/admin/dlq/replay/route.ts`
- [ ] Run Phase 01 DLQ contract tests — confirm they now PASS
- [ ] Run existing DLQ tests — confirm no regressions
- [ ] Run `npm test` — all tests pass
- [ ] Run `npm run type-check` — 0 errors
- [ ] Run `npm run build` — 0 errors
- [ ] Apply migration locally

## Success Criteria
- `payment_events_dropped` table exists with proper indexes
- DLQ overflow records event in `payment_events_dropped` before rejecting
- `GET /api/admin/dlq/reconciliation` returns dropped + stale DLQ entries
- `POST /api/admin/dlq/replay` replays a dropped event through the IPN handler
- Contract tests from Phase 01 all pass
- All existing tests pass
- `npm run build` exits 0
- Zero `:any` types introduced
- Auth gated on admin endpoints

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `recordDroppedEvent` INSERT fails under D1 contention | Low | Medium | Non-fatal — logged but doesn't block rejection. Event data still in `logger.error` output. |
| Admin replay endpoint exposes IPN handler to unauthenticated access | Low | High | Auth guard via `getCurrentUser()` + admin role check. Return 401/403 for unauthorized. |
| New migration conflicts with existing migration numbering | Low | Low | Check `ls migrations/ | sort | tail -1` before creating. |
| Dropped events table grows unbounded | Medium | Low | No auto-purge in Phase 03. Future enhancement: periodic purge cron for entries older than 90 days. Admin reconciliation endpoint provides visibility. |

## Security Considerations
- Admin endpoints use Better Auth session — inherits existing CSRF/CORS/MFA protection from middleware
- `payment_events_dropped` table stores IPN payload (may contain `customer_email`). Access restricted to admin role.
- Replay endpoint re-processes the original IPN payload through the full handler — this is intentional (replay should go through the same validation path)
- No new third-party credentials or external services introduced

## Next Steps
- Phase 04: Integration tests — end-to-end IPN flow
