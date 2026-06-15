# Phase 06 — Move Manifest (Land Layer)
Generated: 2026-05-03 | Total moved: 111 files via git mv

## Summary

| Group | Count |
|-------|-------|
| src/land/billing (+ dunning/ + email/ + __tests__) | 56 |
| src/land/payments (+ __tests__) | 2 |
| src/land/status | 2 |
| src/land/affiliates (+ providers/) | 21 |
| src/land/checkout | 1 |
| src/land/orders (+ __tests__) | 7 |
| src/land/payouts (+ __tests__) | 10 |
| src/land/promo | 5 |
| src/land/refunds | 1 |
| src/land/wallet (+ tests) | 7 |
| src/land/affiliates.ts (loose) | 1 |

## Key Decisions
- `lib/affiliates.ts` (loose root file) moved to `land/affiliates.ts`
- All `src/app/**/*` route files — STAYED per Next.js convention
- `@deprecated` JSDoc comments in dunning-workflow.ts/resend-email-service.ts left as-is (not real imports)
- tsconfig.json `@/land/*` alias was already configured (no changes needed)

## Codemod Stats
- Files changed: 74 (ts-morph codemod)
- Imports rewritten: 115 (ts-morph codemod)
- vi.mock paths fixed: 16 (7 files via sed)
- Manual fix in forest/inngest/functions/index.ts: 4 imports (affiliates + payouts crons)

## Manual Fixes Applied

### vi.mock() test path fixes (sed)
- `src/app/api/admin/payouts/mark-paid/route.test.ts`: wallet paths
- `src/app/api/checkout/status/__tests__/route.test.ts`: orders paths
- `src/app/api/cron/wallet-rebuild/route.test.ts`: wallet paths
- `src/app/api/webhooks/clickbank/route.test.ts`: affiliates paths
- `src/land/billing/__tests__/nowpayments-ipn-atomic-upgrade.test.ts`: orders + billing paths
- `src/land/billing/__tests__/tier-transition-matrix.test.ts`: orders + billing paths
- `src/lib/fulfillment/__tests__/complete-video-from-webhook.test.ts`: billing/email paths

### forest/inngest/functions/index.ts (manual)
- `@/lib/affiliates/offer-sync-cron` → `@/land/affiliates/offer-sync-cron`
- `@/lib/payouts/pending-promoter-cron` → `@/land/payouts/pending-promoter-cron`
- `@/lib/payouts/payout-batcher` → `@/land/payouts/payout-batcher`
- `@/lib/payouts/reconciliation` → `@/land/payouts/reconciliation`

## Build Result
- `npm run build`: PASS (0 TS errors, ✓ Compiled successfully in 14.5s)
- `npm test --run`: PASS (2546 / 0 fail, 258 test files + 1 skipped)
- Webhook tests: NOWPayments IPN dispatch/idempotency/atomic + PayOS all PASS
- Stale @/lib/ land imports: 0

## Critical Webhooks Verified
- NOWPayments IPN dispatch: PASS (all 16 routing cases)
- NOWPayments IPN one-time: PASS (idempotency + underpayment guard)
- NOWPayments IPN atomic upgrade: PASS
- PayOS tests: PASS
- HMAC signature verification (raas-service): PASS
