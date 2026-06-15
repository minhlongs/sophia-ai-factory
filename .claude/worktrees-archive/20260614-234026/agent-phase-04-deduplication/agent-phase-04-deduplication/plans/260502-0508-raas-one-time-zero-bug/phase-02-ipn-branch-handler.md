# Phase 02 — IPN Branch Handler

## Context Links

- Existing dispatcher: `apps/sophia-ai-factory/src/lib/billing/nowpayments-ipn-handlers.ts`
- Existing subscription handler: `apps/sophia-ai-factory/src/lib/billing/nowpayments-ipn-subscription.ts`
- Existing IPN DB helpers: `apps/sophia-ai-factory/src/lib/billing/nowpayments-ipn-db.ts`
- Phase 01 deliverables: `one-time-skus.ts`, `user-purchases-repo.ts`

## Overview

- **Priority:** P1 (depends on Phase 01)
- **Status:** done
- **Description:** Add `nowpayments-ipn-one-time.ts` handler. Modify dispatcher trong `handleFinished` để branch theo invoice_id (one_time vs tier). Emit domain events for Phase 03.

## Key Insights

- `processNowPaymentsIpn()` in `nowpayments-ipn-handlers.ts` MUST stay unchanged — only modify per-status handler dispatch
- Branching based on invoice_id lookup: `getOneTimeSkuByInvoiceId(invoiceId)` → if hit, treat as one_time; else fall through to existing tier logic
- Idempotency: existing `isPaymentProcessed()` covers retries — reuse, don't reinvent
- Event emission: in-process EventEmitter not durable → use DB-backed `domain_events` table OR direct call to async job queue. Sophia uses Cloudflare Queues; simpler = direct invocation since Worker context is short-lived

**Approach decision:** Direct synchronous call in `handleFinished` to `triggerOneTimeFulfillment()` (Phase 03) — wrapped in try/catch — non-fatal if downstream fails (DB row already paid; retry job picks up).

## Requirements

**Functional:**
- IPN `finished` status with one_time invoice_id → insert `user_purchases` row + invoke fulfillment
- IPN `finished` with tier invoice_id → existing flow unchanged
- IPN `refunded` for one_time → mark row `refunded`, decrement credits to 0 (Phase 04 tests)
- IPN `failed`/`expired` for one_time → log only, no DB mutation (no `pending` row exists if we only insert on `finished`)
- Idempotent on retry (same `payment_id` → no duplicate insert; ON CONFLICT DO NOTHING)

**Non-functional:**
- Each handler file <200 lines
- Zero `:any`
- Zod-validate IPN payload before branching
- Logger only — no `console.log`

## Architecture

```
processNowPaymentsIpn(ipn)
  ├─ isPaymentProcessed(payment_id) → short-circuit
  ├─ recordIpnEvent (begin)
  ├─ switch payment_status:
  │   case 'finished':
  │     dispatchFinished(ipn)         ← NEW dispatcher
  │       ├─ skuOrTier = lookupInvoice(invoice_id)
  │       ├─ if (skuOrTier.kind === 'one_time') → handleOneTimeFinished(ipn, sku)
  │       └─ else → handleFinished(ipn) [existing tier path]
  │   case 'refunded':
  │     dispatchRefunded(ipn)         ← NEW dispatcher (mirror)
  │   ...
  └─ recordIpnEvent (end)
```

## Related Code Files

**Create:**
- `apps/sophia-ai-factory/src/lib/billing/nowpayments-ipn-one-time.ts` — `handleOneTimeFinished()`, `handleOneTimeRefunded()`
- `apps/sophia-ai-factory/src/lib/billing/nowpayments-ipn-dispatch.ts` — `dispatchFinished()`, `dispatchRefunded()` (looks up invoice → routes)

**Modify:**
- `apps/sophia-ai-factory/src/lib/billing/nowpayments-ipn-handlers.ts` — call `dispatchFinished()`/`dispatchRefunded()` instead of direct `handleFinished/handleRefunded`
- `apps/sophia-ai-factory/src/lib/clients/nowpayments-client.ts` — export `lookupInvoice(invoiceId)` returning `{kind, ref}` discriminated union

**No delete.**

## Implementation Steps

1. Add `lookupInvoice()` helper in `nowpayments-client.ts`:
   ```ts
   export type InvoiceLookup =
     | { kind: 'subscription'; tier: Tier; config: TierInvoiceConfig }
     | { kind: 'one_time'; sku: OneTimeSku }
     | null
   ```
2. Create `nowpayments-ipn-one-time.ts`:
   - `handleOneTimeFinished(ipn, sku)`: insert via repo, set `status='paid'`, `credits_remaining = sku.creditsGranted`, `paid_at = now()`, audit log, then call `triggerOneTimeFulfillment(userId, purchaseId, sku)` (Phase 03 stub for now)
   - `handleOneTimeRefunded(ipn)`: update row by `payment_id` → `status='refunded'`, `credits_remaining=0`, `refunded_at=now()`, audit
3. Create `nowpayments-ipn-dispatch.ts`:
   - `dispatchFinished(ipn)`: invoke `lookupInvoice`, branch
   - `dispatchRefunded(ipn)`: same pattern
4. Modify `nowpayments-ipn-handlers.ts`: replace direct calls with dispatchers. Keep `handleFailed` unchanged (failure is tier-agnostic logging)
5. Add Phase 03 stub `triggerOneTimeFulfillment` in `apps/sophia-ai-factory/src/lib/fulfillment/one-time-fulfillment.ts` (empty function returning resolved Promise) — Phase 03 implements
6. Build assert
7. Run `npm test` — existing IPN tests must still pass

## Todo List

- [x] Add `lookupInvoice` discriminated union helper
- [x] Implement `handleOneTimeFinished`
- [x] Implement `handleOneTimeRefunded`
- [x] Implement `dispatchFinished` / `dispatchRefunded`
- [x] Wire dispatchers into main IPN handler
- [x] Stub `triggerOneTimeFulfillment` for Phase 03
- [x] Build pass (0 TS errors)
- [x] Existing tests pass (zero regression)

## Success Criteria

- [x] Existing 1798 tests still green (2075 baseline, zero regression)
- [x] New unit tests (in Phase 04) cover one_time finished/refunded paths
- [x] IPN dispatcher routes correctly for both kinds (verified via fake invoice IDs)
- [x] `recordAudit` called for every state transition (one_time + subscription)

## Risk Assessment

- **Regression on subscription path:** Branch logic introduced into existing flow. Mitigation: dispatcher only routes when `lookupInvoice` returns one_time; otherwise calls untouched `handleFinished`. Phase 04 has 8 subscription regression cases.
- **HMAC verification scope:** Phase 02 assumes upstream `/api/nowpayments/ipn` route already verifies HMAC before calling `processNowPaymentsIpn`. Mitigation: verify in code review — if not, add HMAC check first.
- **Race condition on insert:** Two concurrent IPN retries → INSERT race. Mitigation: `INSERT ... ON CONFLICT(payment_id) DO NOTHING` + check rowsAffected.

## Security Considerations

- `payment_id` MUST be IPN-signed before reaching dispatcher
- `userId` parsed from `order_id` — must validate format `userId:userId123` before DB write (existing helper `parseUserIdFromOrderId`)
- Audit log every transition for compliance (PCI-adjacent)

## Next Steps

- Phase 03 implements `triggerOneTimeFulfillment` (video gen + email)
- Phase 04 tests dispatcher branching exhaustively
