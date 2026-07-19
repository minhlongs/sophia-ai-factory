# Sophia AI Factory — Revenue/Growth Parallel Batch

**Date:** 2026-04-29 21:01 PT
**Mode:** /cook --auto --parallel
**Goal:** Mở doanh thu sau BYOK 100/100 — 3 parallel features
**Production base:** ed13e406 / 91bf4e0b (BYOK live, /api/health green)

## Phase Map (parallel — independent file ownership)

| Phase | Description | Owner | Status |
|-------|-------------|-------|--------|
| A | NOWPayments tier upgrade E2E verify + UX hardening | fullstack-developer-payments | ✅ done (12 tests) |
| B | Telegram bot reactivation audit + setWebhook docs | fullstack-developer-telegram | ✅ done (40 tests, docs) |
| C | Affiliate dashboard wire to real D1 data | fullstack-developer-affiliate | ✅ done (5 tests, refactor) |

**Final report:** [final-signoff.md](./final-signoff.md)
**Tester:** 1714/1745 pass (+18) | **Reviewer:** 9.6/10 APPROVE | **TS:** 0 errors

**Independence guarantee:** Zero file overlap between A/B/C.

## Constraints

- Stack: Next.js 16 + Cloudflare Workers + D1 + Better Auth + NOWPayments
- Zero `:any`, zero `console.log` in production code
- Polar.sh REJECTED — DO NOT use
- App code lives in `apps/sophia-ai-factory/`
- Manual deploy ONLY (CI stuck)
- Tier enum: BASIC | PREMIUM | ENTERPRISE | MASTER

## Success Criteria

- [ ] Phase A: /api/checkout?tier=BASIC|PREMIUM|ENTERPRISE|MASTER returns NOWPayments invoice URL when authed
- [ ] Phase A: anonymous user gets redirected to /login?redirect=...
- [ ] Phase B: /api/webhooks/telegram POST handles known commands without 500
- [ ] Phase B: README documents `wrangler secret put TELEGRAM_BOT_TOKEN` + curl setWebhook command
- [ ] Phase C: /affiliate-discovery renders REAL data from D1 (not DEMO_PRODUCTS)
- [ ] Phase C: empty-state UI when no rows
- [ ] All: 0 TS errors, tests pass, deploy SHA matches local HEAD

## Phase Files

- [phase-a-nowpayments-checkout-verify.md](./phase-a-nowpayments-checkout-verify.md)
- [phase-b-telegram-bot-reactivation.md](./phase-b-telegram-bot-reactivation.md)
- [phase-c-affiliate-real-data.md](./phase-c-affiliate-real-data.md)

## Open Questions

- Telegram bot token: a có sẵn `@Sophia_Bbot` token chưa, hay cần BotFather mới?
- Affiliate `affiliate_offers_selected` table: có dữ liệu thật không hay phải seed?
- NOWPayments: invoice generation có cần wallet whitelist gì không?
