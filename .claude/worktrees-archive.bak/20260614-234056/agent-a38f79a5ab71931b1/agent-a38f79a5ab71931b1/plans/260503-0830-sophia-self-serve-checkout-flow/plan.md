---
title: "Sophia Self-Serve Checkout Flow"
description: "Public pricing → NOWPayments invoice → IPN tier activation → receipt — no admin in the loop"
status: complete
priority: P1
effort: 9h45m
branch: main
tags: [checkout, payments, nowpayments, payos, billing, raas, a16z-land]
created: 2026-05-03
completed: 2026-05-03
locked_decisions: 2026-05-03
---

## Goal
Eliminate manual admin tier upgrades. User picks tier on /pricing → NOWPayments invoice → pays USDT/BTC/ETH → IPN webhook activates tier atomically + idempotently → receipt email + dashboard reflects upgrade. PayOS VN flow stubbed behind flag.

## Gap Closure
Closes GAP 2 (a16z Land layer) — Sophia becomes self-serve SaaS.

## Discovery Outcome
Most infrastructure already exists (see `reports/scout-report.md`). Real work = (a) `pending_orders` D1 table for order tracking, (b) status polling on success page, (c) receipt email, (d) dashboard widget routes via tracked POST, (e) idempotency hardening tests, (f) PayOS stub behind flag.

## Phases
| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 01 | D1 migration + pending_orders module | 45m | complete |
| 02 | Checkout API hardening (period MONTH+YEAR, pending_orders write, dashboard widget route) | 90m | complete |
| 03 | NOWPayments IPN idempotency + atomic upgrade hardening + tests | 75m | complete |
| 04 | PayOS VN FULL impl (VND QR + IPN HMAC + tier activation E2E) | 120m | complete |
| 05 | Success/failure pages with status polling | 45m | complete |
| 06 | Receipt email + VAT 10% bilingual template + send on IPN finished | 45m | complete |
| 07 | Dashboard tier widget — tracked checkout + period info + period_end | 30m | complete |
| 08 | Tests — Vitest unit (HMAC × 2 providers, idempotency, state machine) + i18n keys | 75m | complete |

Total: 9h 45m (pad ~30m for iteration)

## Locked Decisions (2026-05-03)
- ✅ **Yearly billing IN scope** — monthly + yearly toggle on /pricing, separate NOWPayments invoice IDs per period, dashboard shows period_end (+~1h to phase-02 + phase-07)
- ✅ **PayOS FULL impl** — VND QR code, IPN webhook with HMAC verify, end-to-end VND tier activation (+~2h, replaces phase-04 stub)
- ✅ **Receipt includes VAT 10%** — Vietnamese law dịch vụ số 10% VAT line item, bilingual receipt template (+~15m to phase-06)

## Out of Scope (Defer)
- Refund self-service (admin-only today, separate gap)
- Subscription auto-renewal (NOWPayments has no recurring; rebill via cron from `subscriptions.current_period_end` is its own gap)

## Key Dependencies
- D1 binding `DB` (already wired)
- NOWPAYMENTS_IPN_SECRET (already in CI/CF secrets)
- Resend (already in env, used for handover)
- Better Auth `getCurrentUser()`
- Tier config `@/config/tiers` (canonical)

## Critical Risks (mitigations in phase files)
1. HMAC-SHA512 verification edge runtime — covered by `verifyIpnSignature` already
2. IPN replay → idempotent via `payment_events.event_id UNIQUE` + `isPaymentProcessed()`
3. Concurrent tier upgrade race → use D1 transaction in handleFinished
4. Success page shows success on `confirming` (not `finished`) → polling against pending_orders.status
5. Wrong invoice_id mapping → constant-time lookup in `getTierByInvoiceId`

## Success Criteria (Definition of Done)
- 0 `:any` types in new files; Zod on every input
- All 8 phases completed with checked todos
- npm run build → 0 errors
- npm test → all pass (existing 844+ + new ~30)
- Playwright E2E: full purchase flow with NOWPayments sandbox passes
- Production deploy verified via `/api/version` SHA match
- Manual smoke: 4 tiers checkout URL generation works end-to-end
