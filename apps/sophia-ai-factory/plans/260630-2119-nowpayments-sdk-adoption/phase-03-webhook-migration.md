---
title: "Phase 03: Webhook Migration"
description: "Replace custom HMAC verification + manual JSON parse with sdk.parseWebhook() in webhook route, adapt IPN handlers to SDK-typed events"
status: pending
priority: P1
effort: 1.5h
phase: 03
depends_on: [01]
blocks: [04]
---

# Phase 03: Webhook Migration

## Overview

Replace the manual HMAC-SHA512 verification + Zod validation chain in the IPN webhook route with `sdk.parseWebhook()`. The SDK handles signature verification internally and returns a typed `PaymentEvent`. An adapter maps the SDK event to the internal `NowPaymentsIpnPayload` type so downstream IPN handlers require minimal changes.

## Key Insights

- **`sdk.parseWebhook(payload, signature)` does verification + parsing in one call** — replaces `verifyIpnSignature()` + `JSON.parse()` + `ipnPayloadSchema.safeParse()`
- **SDK status mapping**: `finished` → `paid`, `refunded` → `refunded`, etc. The raw API status (`payment_status`) is still accessible on `event.payment.payment_status`
- **Critical unknown**: does `PaymentEvent.payment` include `invoice_id`? If not, adapter extracts from raw JSON payload
- **IPN handlers stay mostly unchanged** — adapter maps SDK types → `NowPaymentsIpnPayload` which all handlers already consume
- **Payout webhook is separate** — `src/app/api/webhooks/nowpayments-payout/route.ts` continues using `verifyIpnSignature()` (not replaced — SDK doesn't cover payouts)
- **Synthetic IPN test route** — must be updated to build signatures compatible with SDK's `parseWebhook`

## Architecture: Webhook Data Flow (New)

```
NOWPayments sends IPN POST
  → /api/webhooks/nowpayments
    → Read raw body + x-nowpayments-sig header (unchanged)
    → SDK: sdk.parseWebhook(jsonPayload, signature)
      → SDK verifies HMAC-SHA512 internally
      → SDK validates payload shape
      → Returns PaymentEvent { type, payment }
    → Adapter: sdkEventToInternalPayload(event, rawPayload)
      → Maps Payment → NowPaymentsIpnPayload
      → Extracts invoice_id (from SDK or raw payload fallback)
    → Zod validate (defense-in-depth)
    → processNowPaymentsIpn(ipn) — UNCHANGED
      → dispatchFinished / dispatchRefunded — UNCHANGED
        → handleFinished / handleOneTimeFinished — UNCHANGED
```

## Files to Modify

| File | Action | Risk |
|------|--------|------|
| `src/app/api/webhooks/nowpayments/route.ts` | Replace `verifyIpnSignature()` + manual parse with `sdk.parseWebhook()` via adapter | **Protected flow** |
| `src/tree/clients/nowpayments-client.ts` | Add `sdkEventToInternalPayload()` adapter function | Medium |
| `src/land/billing/nowpayments-ipn-handlers.ts` | `NowPaymentsIpnPayload` type stays; verify all fields mapped | Low |
| `src/app/api/admin/synthetic-ipn/route.ts` | Update signature builder to use SDK-compatible HMAC | Medium |
| `src/app/api/webhooks/nowpayments-payout/route.ts` | Keep using `verifyIpnSignature()` — no changes needed | None |

### Test Files to Update

| Test File | What Changes |
|-----------|-------------|
| `src/tree/clients/__tests__/nowpayments-hmac.test.ts` | **DELETE** (SDK handles HMAC) |
| `src/land/billing/__tests__/nowpayments-ipn-dispatch.test.ts` | Verify dispatch tests still pass |
| `src/land/billing/__tests__/ipn-payload-schema-contract.test.ts` | Schema validation still applied post-SDK |
| `src/land/billing/__tests__/ipn-concurrent-processing-contract.test.ts` | Lock logic unchanged |
| `src/land/billing/__tests__/nowpayments-ipn-one-time.test.ts` | One-time handler tests unchanged |
| `src/land/billing/__tests__/nowpayments-ipn-idempotency.test.ts` | Idempotency logic unchanged |
| `src/land/billing/__tests__/nowpayments-ipn-atomic-upgrade.test.ts` | Subscription activation unchanged |
| `src/land/billing/__tests__/nowpayments-dlq.test.ts` | DLQ logic unchanged |
| `src/land/billing/__tests__/nowpayments-e2e-payment-lifecycle.test.ts` | Update IPN simulation to go through SDK adapter |
| `src/land/billing/__tests__/ipn-subscription-lifecycle-contract.test.ts` | Tier config unchanged |

## Implementation Steps

### Step 1: Implement `sdkEventToInternalPayload()` adapter

In `src/tree/clients/nowpayments-client.ts`:

```typescript
import type { NowPaymentsIpnPayload } from '@/land/billing/nowpayments-ipn-handlers'

export function sdkEventToInternalPayload(
  event: { type: string; payment: Record<string, unknown> },
  rawPayload: Record<string, unknown>
): NowPaymentsIpnPayload {
  const p = event.payment
  return {
    payment_id: String(p.payment_id ?? rawPayload.payment_id ?? ''),
    payment_status: (p.payment_status as NowPaymentsIpnPayload['payment_status']) ?? 'waiting',
    pay_address: p.pay_address as string | undefined,
    price_amount: Number(p.price_amount ?? rawPayload.price_amount ?? 0),
    price_currency: String(p.price_currency ?? rawPayload.price_currency ?? 'USD'),
    pay_amount: p.pay_amount != null ? Number(p.pay_amount) : undefined,
    pay_currency: p.pay_currency as string | undefined,
    order_id: p.order_id as string | undefined,
    order_description: p.order_description as string | undefined,
    // invoice_id may not be in SDK Payment type — fallback to raw payload
    invoice_id: (p.invoice_id ?? rawPayload.invoice_id) as string | undefined,
    actually_paid: rawPayload.actually_paid != null ? Number(rawPayload.actually_paid) : undefined,
    outcome_amount: rawPayload.outcome_amount != null ? Number(rawPayload.outcome_amount) : undefined,
    outcome_currency: rawPayload.outcome_currency as string | undefined,
    customer_email: rawPayload.customer_email as string | undefined,
  }
}
```

### Step 2: Refactor webhook route `POST` handler

In `src/app/api/webhooks/nowpayments/route.ts`, replace lines 48-110 (signature verification + parsing) with:

```typescript
import { parseIpnWebhook } from '@/tree/clients/nowpayments-client'
// Remove: verifyIpnSignature, lookupInvoice (keep lookupInvoice — still used at line 131)

export async function POST(request: NextRequest) {
  // ... read raw body (unchanged) ...

  const signature = request.headers.get('x-nowpayments-sig')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let rawPayload: Record<string, unknown>
  try { rawPayload = JSON.parse(rawBody) as Record<string, unknown> }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  let ipn: NowPaymentsIpnPayload
  try {
    ipn = parseIpnWebhook(rawPayload, signature)
  } catch (err) {
    // SDK throws ValidationError with code: INVALID_WEBHOOK_SIGNATURE
    logger.warn('[NOWPayments Webhook] SDK verification failed', { error: String(err) })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Defense-in-depth: Zod validation still applied
  const parsed = ipnPayloadSchema.safeParse(ipn)
  if (!parsed.success) {
    logger.warn('[NOWPayments Webhook] Invalid payload shape', { errors: parsed.error.flatten() })
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // ... rest unchanged (processNowPaymentsIpn, PostHog, emit) ...
}
```

### Step 3: Update imports in webhook route

Remove imports that are no longer needed:
- `verifyIpnSignature` — replaced by `parseIpnWebhook`
- `ipnPayloadSchema` — KEEP (defense-in-depth validation)
- `lookupInvoice` — KEEP (used for PostHog tier lookup at line 131)
- `NOWPAYMENTS_IPN_SECRET` env retrieval — KEEP (SDK needs it passed via factory)

### Step 4: Update `parseIpnWebhook()` in wrapper

```typescript
export function parseIpnWebhook(
  payload: Record<string, unknown>,
  signature: string
): NowPaymentsIpnPayload {
  const sdk = createNowPaymentsSDK()
  const event = sdk.parseWebhook(payload, signature, { verify: true })
  return sdkEventToInternalPayload(event, payload)
}
```

### Step 5: Update synthetic IPN test route

In `src/app/api/admin/synthetic-ipn/route.ts`, the `buildIpnSignature()` function (lines 53-67) builds HMAC-SHA512 the same way the SDK does. The SDK's `parseWebhook` should accept this signature. Verify compatibility:
- SDK sorts JSON keys before HMAC → our `buildIpnSignature` already does this (line 54: `Object.keys(payload).sort()`)
- SDK uses HMAC-SHA512 → our `buildIpnSignature` uses `SHA-512`

If the SDK signature format differs, update `buildIpnSignature()` to match.

### Step 6: Update test files

Update webhook-related tests:

- **Webhook route tests**: Mock `parseIpnWebhook()` instead of `verifyIpnSignature()`
- **IPN handler tests**: Unchanged — they receive `NowPaymentsIpnPayload` via `processNowPaymentsIpn()`
- **Adapter tests**: Add to `nowpayments-client.test.ts` — test `sdkEventToInternalPayload()` with various payload shapes

### Step 7: Run full test suite

```bash
npm test
```

Must pass 6525+ tests.

## Todo List

- [ ] Implement `sdkEventToInternalPayload()` adapter in `nowpayments-client.ts`
- [ ] Implement `parseIpnWebhook()` in `nowpayments-client.ts`
- [ ] Refactor webhook route POST handler — replace verify + parse with `parseIpnWebhook()`
- [ ] Update webhook route imports (remove unused, keep needed)
- [ ] Update synthetic IPN test route `buildIpnSignature()` if needed
- [ ] Add adapter unit tests to `nowpayments-client.test.ts`
- [ ] Update webhook route tests
- [ ] Delete `nowpayments-hmac.test.ts`
- [ ] Run `npm test` — all tests pass
- [ ] Run `npm run type-check` — 0 errors

## Success Criteria

- Webhook signature verified by SDK (not custom HMAC code)
- `parseIpnWebhook()` returns valid `NowPaymentsIpnPayload`
- `invoice_id` correctly extracted (from SDK or raw payload fallback)
- `processNowPaymentsIpn()` receives identical payload shape to before
- Subscription activation works end-to-end (via synthetic IPN test)
- All webhook-related Zod validation still applied (defense-in-depth)
- Payout webhook unchanged (uses `verifyIpnSignature()` — no regression)
- `npm test` — all tests pass

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SDK `PaymentEvent` missing `invoice_id` | Medium | **Critical** | Adapter falls back to `rawPayload.invoice_id` |
| SDK signature format differs from current | Low | High | Verify with synthetic IPN test; update `buildIpnSignature()` if needed |
| SDK status mapping conflicts with `payment_status` enum | Low | Medium | Use raw `payment_status` from SDK payment, not SDK-mapped `status` |
| Payout webhook regression | Low | High | Payout route still uses `verifyIpnSignature()` — explicitly excluded from this migration |
| Zod schema rejects SDK-mapped payload | Low | Medium | Defense-in-depth Zod validation catches any field mismatch early |

## Security Considerations

- **Protected flow**: NOWPayments IPN webhook is a protected flow per CLAUDE.md — any breakage is critical
- SDK `parseWebhook()` uses timing-safe comparison internally
- `ipnSecret` passed to SDK constructor — SDK handles HMAC key management
- Zod validation still applied AFTER SDK parsing — defense-in-depth against SDK bugs
- `invoice_id` fallback to raw payload is safe — raw payload is already JSON-parsed, not user-controlled after signature verification

## Next Steps

- Phase 04 (Cleanup + Verify) — after both Phase 02 and 03 complete
