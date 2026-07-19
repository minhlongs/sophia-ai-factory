---
title: "NOWPayments SDK Full Adoption"
description: "Replace pre-created invoice IDs with API-created checkouts and SDK-based webhook verification"
status: completed
priority: P1
effort: 5h
branch: main
tags: [nowpayments, sdk, billing, payment-flow, protected-flow]
created: 2026-06-30
---

# NOWPayments SDK Full Adoption

## Summary

Replace the pre-created invoice redirect pattern with the official `@nowpaymentsio/nowpayments-sdk-nodejs` for both checkout creation and IPN webhook verification. The SDK handles signature verification, request normalization, and typed responses — eliminating custom HMAC-SHA512 code and hardcoded invoice IDs.

## What Changes

| Concern | Before | After |
|---------|--------|-------|
| Checkout | `createInvoiceUrl()` — builds URL with pre-created `iid` | `sdk.createCheckout()` — API call returns `invoice_url` |
| Tier mapping | `NOWPAYMENTS_TIERS` hardcoded invoice IDs | Config has `price`/`currency` for API input |
| IPN verify | `verifyIpnSignature()` — custom HMAC-SHA512 + canonicalize | `sdk.parseWebhook()` — built-in verify + typed output |
| IPN payload | Manual `JSON.parse` + Zod validate | SDK returns typed `PaymentEvent` → adapter maps to internal type |
| Webhook sig | Custom `nowPaymentsCanonicalize()` sorts JSON keys | SDK handles internally |

## What Stays the Same

- IPN processing logic (subscription activation, one-time fulfillment, DLQ, idempotency)
- Payouts code (SDK doesn't cover mass payouts — `verifyIpnSignature` kept for payout webhook)
- Database schema (subscriptions, orders, click_events, payment_events)
- Webhook route path (`/api/webhooks/nowpayments`)
- Tier lookup via `getTierByInvoiceId()` — kept as deprecated backward-compat shim
- NOWPAYMENTS_IPN_SECRET env var

## Phases

| # | Phase | Effort | Dependencies | Status |
|---|-------|--------|-------------|--------|
| 01 | [SDK Setup + Wrapper](./phase-01-sdk-setup-wrapper.md) | 1.5h | none | completed |
| 02 | [Checkout Migration](./phase-02-checkout-migration.md) | 1h | Phase 01 | completed |
| 03 | [Webhook Migration](./phase-03-webhook-migration.md) | 1.5h | Phase 01 | completed |
| 04 | [Cleanup + Verify](./phase-04-cleanup-verify.md) | 1h | Phase 02, 03 | completed |

## Key Risks

1. **API key scope** — checkout now needs `NOWPAYMENTS_API_KEY` (write permission). Currently used by payouts; must be set for checkout to work.
2. **`invoice_id` in SDK webhook events** — SDK `PaymentEvent` must include `invoice_id` for tier dispatch. Fallback: parse raw body for missing fields.
3. **ESM-only SDK** — Next.js handles ESM deps natively. Verify with build.
4. **Network dependency** — checkout now depends on NOWPayments API being up. Fallback: pre-created invoice IDs as emergency escape hatch.

## Success Criteria

- `npm run build` → 0 TypeScript errors
- `npm test` → 6525+ pass
- `sdk.createCheckout()` returns `invoice_url` → user redirected successfully
- `sdk.parseWebhook()` verifies IPN signature → subscription activated
- Synthetic IPN test (`/api/admin/synthetic-ipn`) works end-to-end
- No `:any` types introduced
- `NOWPAYMENTS_API_KEY` validated as required for production

## Rollback

1. Revert `package.json` (remove SDK dep)
2. Restore `createInvoiceUrl()` / `verifyIpnSignature()` from git
3. Revert checkout route to pre-created invoice URL builder
4. `npm run build && npm test` → green
5. Deploy via `npm run deploy:full`

## Unresolved Questions

1. Does SDK `PaymentEvent.payment` include `invoice_id` field from raw IPN payload? If not, adapter must extract from raw JSON.
2. Does the SDK `createCheckout` require `payCurrency` for preflight? Omitting it skips estimate/min-amount checks.
3. Should we keep pre-created invoice IDs as emergency fallback or remove entirely?
