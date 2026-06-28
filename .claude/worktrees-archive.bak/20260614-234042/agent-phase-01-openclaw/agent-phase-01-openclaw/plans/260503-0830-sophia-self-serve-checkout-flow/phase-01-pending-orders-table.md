# Phase 01 — D1 Migration + pending_orders Module

## Context Links
- Scout: `../reports/scout-report.md`
- Existing migration: `apps/sophia-ai-factory/migrations/0002-payment-events.sql`
- Latest migration: `0069-org-branding.sql` → next is `0070`
- D1 client: `src/lib/db/client.ts` (`createServerClient()`)

## Overview
- Priority: P1 (foundation for all phases)
- Status: pending
- Effort: 45m
- Description: Add `pending_orders` D1 table to track checkout intent before IPN arrives, plus a typed module to read/write rows.

## Key Insights
- Current flow loses checkout intent — only `payment_events` records IPN-arrival, not "user clicked Buy at 14:32 with promo XYZ on PREMIUM yearly".
- Status polling on success page needs a row to query.
- Idempotency at order level (before payment_id exists) lets us reject duplicate clicks within 60s.

## Requirements

### Functional
- Create row at POST /api/checkout time
- Update row to `completed` with `payment_id` on IPN finished
- Allow query by `order_id` for status polling
- Allow query by `user_id` for "show my orders" admin/audit

### Non-Functional
- Order_id pattern preserved: `sophia_${userId}_${timestamp}`
- Insertion latency < 50ms on edge
- Status enum: pending | completed | failed | expired

## Architecture
```
POST /api/checkout
  └─ writeOrder(...)               ← new (this phase exposes function)
      └─ pending_orders INSERT
NOWPayments IPN finished
  └─ markOrderCompleted(orderId, paymentId)  ← new
      └─ pending_orders UPDATE
GET /api/checkout/status
  └─ getOrderById(orderId)         ← new
```

## Related Code Files

### Create
- `apps/sophia-ai-factory/migrations/0070-pending-orders.sql` — table + indexes
- `apps/sophia-ai-factory/src/lib/orders/pending-order-types.ts` — types + Zod schema
- `apps/sophia-ai-factory/src/lib/orders/pending-order-repo.ts` — CRUD (writeOrder, getOrderById, markOrderCompleted, markOrderFailed, listOrdersByUser)
- `apps/sophia-ai-factory/src/lib/orders/__tests__/pending-order-repo.test.ts` — repo unit tests

### Modify
- None this phase (consumed in 02 + 03)

## Implementation Steps

1. Create migration `0070-pending-orders.sql`:
   ```sql
   CREATE TABLE IF NOT EXISTS pending_orders (
     order_id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     tier TEXT NOT NULL,
     period TEXT NOT NULL DEFAULT 'monthly',
     payment_method TEXT NOT NULL DEFAULT 'nowpayments',
     amount_usd_cents INTEGER NOT NULL,
     promo_code TEXT,
     customer_email TEXT,
     invoice_url TEXT,
     status TEXT NOT NULL DEFAULT 'pending',
     payment_id TEXT,
     created_at TEXT DEFAULT (datetime('now')),
     completed_at TEXT
   );
   CREATE INDEX IF NOT EXISTS idx_pending_orders_user ON pending_orders(user_id);
   CREATE INDEX IF NOT EXISTS idx_pending_orders_status ON pending_orders(status);
   CREATE INDEX IF NOT EXISTS idx_pending_orders_payment_id ON pending_orders(payment_id);
   ```

2. Create `pending-order-types.ts` (under 50 lines):
   - `PendingOrderStatus = 'pending' | 'completed' | 'failed' | 'expired'`
   - `PaymentMethod = 'nowpayments' | 'payos'`
   - `PendingOrderPeriod = 'monthly' | 'yearly' | 'lifetime'`
   - `PendingOrder` interface (full row shape)
   - `pendingOrderInputSchema` Zod for write inputs

3. Create `pending-order-repo.ts` (~150 lines):
   - `writeOrder(input: PendingOrderInput): Promise<PendingOrder>` — INSERT, returns row
   - `getOrderById(orderId): Promise<PendingOrder | null>` — SELECT with WHERE
   - `markOrderCompleted(orderId, paymentId): Promise<void>` — UPDATE status + completed_at
   - `markOrderFailed(orderId, reason?): Promise<void>` — UPDATE status
   - `listOrdersByUser(userId, limit=10): Promise<PendingOrder[]>`
   - All use `createServerClient()` (sync, no await on client itself)

4. Apply migration locally: `npx wrangler d1 migrations apply sophia-raas-db --local`

5. Run unit tests: write 6 cases covering happy path + null + duplicate `order_id`

## Todo List
- [ ] Create migration 0070-pending-orders.sql
- [ ] Apply migration locally and verify schema with `.schema pending_orders`
- [ ] Create pending-order-types.ts with Zod schema
- [ ] Create pending-order-repo.ts with all 5 functions
- [ ] Write 6 unit tests for repo (happy/null/duplicate/list)
- [ ] Run `npm test src/lib/orders/__tests__/pending-order-repo.test.ts` → green
- [ ] Run `npm run build` → 0 errors
- [ ] Commit `feat: add pending_orders D1 table for checkout tracking`

## Success Criteria
- Migration applies clean on D1 local
- All 6 repo unit tests pass
- Build emits 0 TS errors
- 0 `:any` in new files

## Risk Assessment
- Risk: D1 migration order conflict if another branch merges 0070 first → mitigation: rebase before merge, rename to next free number
- Risk: order_id collision (timestamp ms) → mitigation: PK enforces uniqueness, retry with new timestamp on conflict (rare)

## Security Considerations
- Repo functions never expose `customer_email` to non-owner users (caller responsibility)
- No PII logged in repo — only order_id and status

## Next Steps
- Phase 02: Checkout API consumes `writeOrder()` to persist intent
- Phase 03: IPN handler consumes `markOrderCompleted()`
- Phase 05: Status endpoint consumes `getOrderById()`
