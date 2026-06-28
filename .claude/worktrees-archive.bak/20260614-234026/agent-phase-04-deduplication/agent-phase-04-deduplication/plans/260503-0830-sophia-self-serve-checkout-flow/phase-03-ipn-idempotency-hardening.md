# Phase 03 — NOWPayments IPN Idempotency + Atomic Tier Upgrade

## Context Links
- Webhook route: `apps/sophia-ai-factory/src/app/api/webhooks/nowpayments/route.ts`
- Dispatcher: `src/lib/billing/nowpayments-ipn-handlers.ts`
- Subscription handler: `src/lib/billing/nowpayments-ipn-subscription.ts`
- IPN DB helpers: `src/lib/billing/nowpayments-ipn-db.ts`
- HMAC verification: `src/lib/clients/nowpayments-client.ts` → `verifyIpnSignature`
- Phase 01 deliverable: `pending-order-repo.ts`

## Overview
- Priority: P1 (security-critical — wrong code = paid bypass)
- Status: pending
- Effort: 75m
- Description: Audit and harden HMAC verification, idempotency, and atomic tier transition. Link IPN events back to pending_orders. Add comprehensive tests.

## Key Insights
- HMAC-SHA512 verification ALREADY implemented in `verifyIpnSignature` with timing-safe XOR comparison — verify correctness on Cloudflare Workers edge runtime via test.
- Idempotency check via `payment_events.event_id UNIQUE` ALREADY in place (`isPaymentProcessed()`) — but the dispatch happens BEFORE recording processed=true. If dispatch crashes mid-way, retry will reprocess. Need wrap in try/catch with consistent state.
- Concurrent upgrade race: today `handleFinished()` does multiple `db.from(...)` calls without explicit transaction. D1 supports `db.batch()` for atomic multi-statement. Use it for the org/subscription/audit triplet.
- Today, IPN doesn't link back to `pending_orders` — only updates `subscriptions`. Add `markOrderCompleted(orderId, paymentId)` call.

## Requirements

### Functional
- All 4 tier upgrades (BASIC→PREMIUM, BASIC→ENTERPRISE, BASIC→MASTER, PREMIUM→ENTERPRISE) verified atomic
- IPN replay does not double-activate (200 OK, no DB change)
- pending_orders.status flipped to `completed` on finished
- pending_orders.status flipped to `failed` on failed/expired
- Audit log row written for every tier transition

### Non-Functional
- IPN handler returns 200 within 3s (NOWPayments retry timeout)
- HMAC verification < 50ms
- 100% test coverage on HMAC + idempotency + state machine

## Architecture
```
POST /api/webhooks/nowpayments
  ├─ Read raw body (request.text())
  ├─ Read x-nowpayments-sig header
  ├─ verifyIpnSignature(body, sig, NOWPAYMENTS_IPN_SECRET) ← timing-safe
  ├─ Parse JSON → NowPaymentsIpnPayload
  ├─ Zod validate payload shape (NEW — defensive)
  ├─ processNowPaymentsIpn(ipn)
  │   ├─ if isPaymentProcessed → return { success: true, "Already processed" }
  │   ├─ recordIpnEvent(processed=false)  ← reserve row
  │   ├─ switch payment_status:
  │   │     finished → dispatchFinished → handleFinished (atomic)
  │   │     refunded → handleRefunded
  │   │     failed/expired → handleFailed + markOrderFailed
  │   └─ recordIpnEvent(processed=true)   ← only after success
  └─ Emit posthog/analytics events
```

### Atomic handleFinished (D1 batch)
```ts
const stmts = [
  db.prepare('UPDATE subscriptions SET ... WHERE org_id=?').bind(...),
  db.prepare('UPDATE organizations SET plan=?, updated_at=? WHERE id=?').bind(...),
  db.prepare('UPDATE pending_orders SET status=?, payment_id=?, completed_at=? WHERE order_id=?').bind(...),
  db.prepare('INSERT INTO audit_log ...').bind(...),
];
await db.batch(stmts);
```

## Related Code Files

### Modify
- `src/app/api/webhooks/nowpayments/route.ts` — add Zod payload validation
- `src/lib/billing/nowpayments-ipn-subscription.ts` — refactor handleFinished to use batch + call markOrderCompleted
- `src/lib/billing/nowpayments-ipn-handlers.ts` — extend handleFailed to mark pending_orders failed

### Create
- `src/lib/billing/__tests__/nowpayments-ipn-idempotency.test.ts` — replay tests
- `src/lib/billing/__tests__/nowpayments-ipn-atomic-upgrade.test.ts` — concurrent upgrade tests
- `src/lib/clients/__tests__/nowpayments-hmac.test.ts` — signature verification edge cases (already exists? check; if so, expand)
- `src/lib/billing/ipn-payload-schema.ts` — Zod schema for IPN body

### No-touch
- HMAC verifier `verifyIpnSignature` — leave alone unless test reveals defect

## Implementation Steps

1. Audit `verifyIpnSignature` correctness:
   - Edge case test: empty body, mismatched signature length, malformed JSON, BOM in body
   - Test: same payload with key reorder produces same signature (sorted keys)
   - Test: tampered single byte → returns false
   - Confirm constant-time comparison via timing test (deterministic, not actual timing)

2. Create `ipn-payload-schema.ts` with Zod:
   ```ts
   export const ipnPayloadSchema = z.object({
     payment_id: z.string(),
     payment_status: z.enum(['waiting','confirming','confirmed','sending','partially_paid','finished','failed','refunded','expired']),
     pay_address: z.string().optional(),
     price_amount: z.number().positive(),
     price_currency: z.string(),
     pay_amount: z.number().optional(),
     pay_currency: z.string().optional(),
     order_id: z.string().optional(),
     order_description: z.string().optional(),
     invoice_id: z.string().optional(),
     actually_paid: z.number().optional(),
     outcome_amount: z.number().optional(),
     outcome_currency: z.string().optional(),
     customer_email: z.string().email().optional(),
   });
   ```
   Use in webhook route AFTER signature verification but BEFORE dispatch.

3. Refactor `handleFinished()` in `nowpayments-ipn-subscription.ts`:
   - Build statements list, run via `db.batch(stmts)` for atomicity
   - Call `markOrderCompleted(orderId, paymentId)` (from Phase 01 repo)
   - Keep onboarding video + auto-handover OUTSIDE batch (non-fatal, post-success)
   - Underpayment guard preserved at top

4. Refactor `handleFailed()`:
   - Call `markOrderFailed(orderId, reason)`

5. Idempotency tests (`nowpayments-ipn-idempotency.test.ts`):
   - Send same payment_id twice → only one subscription update
   - Send finished then refunded → subscription cancelled
   - Send finished but DB write fails mid-batch → next retry succeeds (no half-state)

6. Atomic upgrade tests (`nowpayments-ipn-atomic-upgrade.test.ts`):
   - User on BASIC pays for ENTERPRISE → subscription.plan = enterprise, audit row exists, pending_orders.status=completed
   - Concurrent IPN for same payment_id (parallel calls) → only first succeeds, second gets "Already processed"

7. HMAC edge case tests (`nowpayments-hmac.test.ts`):
   - Empty body, wrong key, partial sig length, tampered key, valid sig → all asserted

## Todo List
- [ ] Create `ipn-payload-schema.ts` with Zod
- [ ] Wire schema validation into webhook route after signature check
- [ ] Refactor handleFinished to use db.batch (atomic)
- [ ] Add markOrderCompleted call in handleFinished
- [ ] Add markOrderFailed call in handleFailed
- [ ] Write 6 idempotency tests
- [ ] Write 4 atomic upgrade tests
- [ ] Write 5 HMAC edge case tests
- [ ] Run all tests → green
- [ ] Build → 0 errors
- [ ] Manual: send replay via curl with NOWPayments sandbox sig → confirm 200 + no double-activate

## Success Criteria
- 15 new tests pass
- IPN handler is provably idempotent (replay test)
- handleFinished uses single d1.batch() call
- pending_orders linked to payment_events via payment_id
- Audit log entry exists for every tier transition

## Risk Assessment
- **Critical**: HMAC bypass → covered by 5-case test suite + sandbox manual verification before production
- **Critical**: Race condition on concurrent IPN → covered by isPaymentProcessed UNIQUE constraint + atomic check-and-set test
- **High**: D1 batch partial failure → batch is atomic per Cloudflare D1 docs (single transaction); if it fails, no rows changed → next retry safe
- **Medium**: Non-fatal post-success operations (onboarding video, auto-handover) failing → already wrapped in try/catch, logged

## Security Considerations
- IPN secret stored in CF env (not committed) — verify NOWPAYMENTS_IPN_SECRET set in production via `wrangler secret list`
- Constant-time signature comparison prevents timing attacks
- Zod payload validation prevents injection via unexpected fields
- Order_id parsed defensively — never trust as user identity without DB lookup

## Next Steps
- Phase 04: PayOS webhook with similar idempotency model
- Phase 05: Status page polls pending_orders.status (depends on this phase)
- Phase 06: Receipt email triggered post-handleFinished (depends on this phase)
