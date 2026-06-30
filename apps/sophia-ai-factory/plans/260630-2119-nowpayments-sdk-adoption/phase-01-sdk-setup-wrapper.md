---
title: "Phase 01: SDK Setup + Wrapper"
description: "Install @nowpaymentsio/nowpayments-sdk-nodejs, create SDK wrapper in tree/clients, add env validation"
status: pending
priority: P1
effort: 1.5h
phase: 01
depends_on: []
blocks: [02, 03]
---

# Phase 01: SDK Setup + Wrapper

## Overview

Install the official NOWPayments SDK and create a typed wrapper at `src/tree/clients/nowpayments-client.ts`. The wrapper provides factory functions, checkout creation, and webhook parsing — replacing the current pre-created-invoice URL builder and custom HMAC verification.

## Key Insights

- **SDK is ESM-only, zero deps, Node 18+** — Next.js 16 handles ESM deps natively, no config needed
- **SDK class: `NowPaymentsSDK`** — constructor takes `apiKey` (required), optional `ipnSecret` for webhook verification
- **`createCheckout()` maps to `POST /v1/invoice`** — returns `Invoice` with `invoice_url` for redirect
- **`parseWebhook()` verifies HMAC-SHA512 internally** — replaces `verifyInboundWebhook` + `nowPaymentsCanonicalize`
- **Wrapper lives at `src/tree/clients/nowpayments-client.ts`** — correct layer per 4-layer architecture (tree = domain-specific reusable)

## Files to Modify

| File | Action | Owner |
|------|--------|-------|
| `package.json` | Add `@nowpaymentsio/nowpayments-sdk-nodejs` dep | Phase 01 |
| `src/tree/clients/nowpayments-client.ts` | Rewrite: SDK wrapper + backward-compat shims | Phase 01 |
| `src/seed/config/environment-config.ts` | Make `NOWPAYMENTS_API_KEY` required for production | Phase 01 |
| `src/tree/clients/__tests__/nowpayments-client.test.ts` | Rewrite tests for SDK wrapper | Phase 01 |
| `src/tree/clients/__tests__/nowpayments-hmac.test.ts` | Remove (SDK handles HMAC internally) | Phase 01 |

## Files to Create

None — all changes are modifications to existing files.

## Architecture: SDK Wrapper Design

```typescript
// src/tree/clients/nowpayments-client.ts (new structure)

import { NowPaymentsSDK } from '@nowpaymentsio/nowpayments-sdk-nodejs'

// ── Factory ──────────────────────────────────────────────────────
export function createNowPaymentsSDK(): NowPaymentsSDK {
  const apiKey = process.env.NOWPAYMENTS_API_KEY
  if (!apiKey) throw new Error('NOWPAYMENTS_API_KEY is required')
  return new NowPaymentsSDK({
    apiKey,
    ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET || undefined,
  })
}

// ── Checkout ─────────────────────────────────────────────────────
export interface CreateCheckoutInput {
  tierId: string       // BASIC | PREMIUM | ENTERPRISE | MASTER
  userId: string
  customerEmail?: string
}

export async function createCheckout(input: CreateCheckoutInput): Promise<{
  invoiceUrl: string
  orderId: string
  invoiceId: string
}> {
  const sdk = createNowPaymentsSDK()
  const config = TIER_PRICE_CONFIG[input.tierId]
  if (!config) throw new Error(`Unknown tier: ${input.tierId}`)

  const timestamp = Date.now()
  const orderId = `sophia_${input.userId}_${timestamp}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network'

  const result = await sdk.createCheckout({
    amount: config.price,
    currency: config.currency,
    orderId,
    description: config.name,
    successUrl: `${appUrl}/payment-success?tier=${input.tierId}&order_id=${orderId}` +
      (input.customerEmail ? `&email=${encodeURIComponent(input.customerEmail)}` : ''),
    cancelUrl: `${appUrl}/pricing`,
  })

  return {
    invoiceUrl: result.invoice_url,
    orderId,
    invoiceId: result.id,
  }
}

// ── Webhook ───────────────────────────────────────────────────────
export async function parseIpnWebhook(
  payload: object,
  signature: string
): Promise<NowPaymentsIpnPayload> {
  const sdk = createNowPaymentsSDK()
  const event = sdk.parseWebhook(payload, signature, { verify: true })
  return sdkEventToInternalPayload(event, payload as Record<string, unknown>)
}

// ── Backward compat (deprecated) ─────────────────────────────────
export const NOWPAYMENTS_TIERS = { ... } // kept for emergency fallback
export function getTierByInvoiceId(invoiceId: string): ... // deprecated
export function createInvoiceUrl(...): string // deprecated, wraps pre-created iid
export async function verifyIpnSignature(...): Promise<boolean> // kept for payout webhook
```

## Implementation Steps

### Step 1: Install SDK
```bash
cd apps/sophia-ai-factory
npm install @nowpaymentsio/nowpayments-sdk-nodejs
```

### Step 2: Verify SDK imports work
Run `npx tsc --noEmit` to confirm ESM import works. If type errors, check `moduleResolution` in tsconfig.

### Step 3: Add tier price config
Replace the `invoiceId`-based `NOWPAYMENTS_TIERS` with a price-based config for SDK checkout input:

```typescript
export const TIER_PRICE_CONFIG: Record<string, { price: number; currency: string; name: string }> = {
  BASIC:    { price: 199,  currency: 'USD', name: 'Starter' },
  PREMIUM:  { price: 399,  currency: 'USD', name: 'Growth' },
  ENTERPRISE:{ price: 799,  currency: 'USD', name: 'Premium' },
  MASTER:   { price: 4999, currency: 'USD', name: 'Master' },
}
```

### Step 4: Implement `createNowPaymentsSDK()` factory
Read `NOWPAYMENTS_API_KEY` from env, throw if missing. Pass optional `ipnSecret`.

### Step 5: Implement `createCheckout()` wrapper
Map tier ID → price/currency → SDK `createCheckout()` call. Return `invoiceUrl`, `orderId`, `invoiceId`.

### Step 6: Implement `parseIpnWebhook()` adapter
Call `sdk.parseWebhook(payload, signature)`, then map `PaymentEvent.payment` → internal `NowPaymentsIpnPayload`. Handle `invoice_id` extraction (SDK may or may not include it — fallback to raw payload).

### Step 7: Keep backward-compat exports
- `NOWPAYMENTS_TIERS` — mark `@deprecated`, keep for emergency fallback
- `getTierByInvoiceId()` — mark `@deprecated`
- `createInvoiceUrl()` — mark `@deprecated`, delegates to pre-created invoice URL
- `verifyIpnSignature()` — KEEP (used by payout webhook at `src/app/api/webhooks/nowpayments-payout/route.ts:57`)
- `lookupInvoice()` — KEEP (used by dispatch at `nowpayments-ipn-dispatch.ts:39,111` and webhook route)
- `createOneTimeInvoiceUrl()` — mark `@deprecated`

### Step 8: Update environment config validation
Make `NOWPAYMENTS_API_KEY` required for production in `src/seed/config/environment-config.ts`:
```typescript
NOWPAYMENTS_API_KEY: z.string().min(1).optional()  // keep optional in schema
// Add runtime check: if production and not set, log warning
```

### Step 9: Write unit tests for SDK wrapper
In `src/tree/clients/__tests__/nowpayments-client.test.ts`:
- Mock `NowPaymentsSDK` class
- Test `createCheckout()`: verify SDK called with correct params, returns invoice URL
- Test `createCheckout()`: throws for unknown tier
- Test `parseIpnWebhook()`: verifies signature, maps to internal type
- Test `parseIpnWebhook()`: handles missing `invoice_id` from SDK → falls back to raw payload
- Test `createNowPaymentsSDK()`: throws when API key missing
- Keep backward-compat tests for `verifyIpnSignature()` (payout webhook still uses it)

### Step 10: Remove `nowpayments-hmac.test.ts`
The SDK handles HMAC internally — these tests are no longer needed. The HMAC logic is tested by the SDK's own test suite.

## Todo List

- [ ] Install `@nowpaymentsio/nowpayments-sdk-nodejs`
- [ ] Verify SDK imports + types resolve (`npx tsc --noEmit`)
- [ ] Add `TIER_PRICE_CONFIG` to `nowpayments-client.ts`
- [ ] Implement `createNowPaymentsSDK()` factory
- [ ] Implement `createCheckout()` wrapper
- [ ] Implement `parseIpnWebhook()` adapter
- [ ] Mark old functions as `@deprecated`, keep for backward compat
- [ ] Update `environment-config.ts` validation
- [ ] Write SDK wrapper unit tests (mock SDK class)
- [ ] Remove `nowpayments-hmac.test.ts`
- [ ] Run `npm test` — verify old + new tests pass
- [ ] Run `npm run type-check` — 0 errors

## Success Criteria

- SDK installs without errors
- `npm run type-check` passes (ESM import works)
- `createCheckout()` returns `{ invoiceUrl, orderId, invoiceId }` when mocked
- `parseIpnWebhook()` returns typed `NowPaymentsIpnPayload` when mocked
- Factory throws when `NOWPAYMENTS_API_KEY` missing
- All existing tests that depend on `nowpayments-client.ts` still pass
- No `:any` types in new code

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ESM import fails in Next.js build | Low | High | Verify early with `npx tsc --noEmit` + `npm run build` |
| SDK types missing `invoice_id` in PaymentEvent | Medium | High | Adapter extracts from raw payload as fallback |
| `NOWPAYMENTS_API_KEY` not set in dev env | Medium | Low | Runtime check throws clear error; dev can use fallback pre-created invoices |
| SDK version conflicts with Node/Next.js | Low | Medium | SDK is 0 deps, Node 18+; verify with build |

## Security Considerations

- `NOWPAYMENTS_API_KEY` grants write access (create invoices) — must be secret
- SDK `parseWebhook` handles timing-safe HMAC comparison internally
- `ipnSecret` in SDK constructor is optional — only needed for webhook verification
- No API keys logged or exposed in error messages

## Next Steps

- Phase 02 (Checkout Migration) — unblocked after this phase completes
- Phase 03 (Webhook Migration) — unblocked after this phase completes
