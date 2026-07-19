# P0 Go-Live Fixes — Sophia AI Factory (2026-05-02)

## Status: IN PROGRESS

## Objective
Ship 5 P0 security/revenue fixes to unblock go-live in ≤14 days.

## Phases

| Phase | Fix | Status | ETA |
|-------|-----|--------|-----|
| P0.1  | Per-customer HeyGen webhook secret | ✅ Complete | 2h |
| P0.3  | Remove deprecated getHeyGenClientSync | ✅ Complete | 1h |
| P0.4  | IPN underpayment rejection + mig 0047 | ✅ Complete | 2h |
| P0.5  | Double-pay dedupe + UI loading state | ✅ Complete | 2h |
| P0.2  | Tier limits enforced server-side | ✅ Complete | 3h |

## Key Files

- Webhook: `app/api/webhooks/heygen/route.ts`
- Signature verifier: `lib/webhooks/heygen-signature-verifier.ts`
- Credentials repo: `lib/credentials/user-credentials-repo.ts`
- Tier quota: `lib/auth/enforce-tier-quota.ts` (new)
- IPN one-time: `lib/billing/nowpayments-ipn-one-time.ts`
- Checkout: `app/api/payments/one-time-checkout/route.ts`
- Migration: `migrations/0047-user-purchases-underpaid.sql` (new)

## Constraints
- Zero `:any`, zero `console.log`
- File ≤200 LOC
- Bilingual UI
- Do NOT touch `nowpayments-ipn-subscription.ts` (except underpayment check)
- Tier enum unchanged: BASIC | PREMIUM | ENTERPRISE | MASTER
