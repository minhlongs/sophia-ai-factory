# Planner Report — Sprint M (Revenue Path)

**Date:** 2026-04-27 03:06 PT
**Plan:** `plans/260427-0306-sprint-m-revenue-path/`
**Goal:** Make first dollar of revenue flow through Sophia AI Factory.

## Phases delivered

| # | File | Effort | LOC est (impl) |
|---|------|--------|---------------|
| Plan | `plan.md` | overview | n/a |
| M1 | `phase-01-unblock-pipeline.md` | 1d | ~150 (2 SQL migrations + telegram-handler refactor) |
| M2 | `phase-02-kill-mock-fraud.md` | 0.5d | ~200 (errors.ts + factory refactor + refund-notify + tests) |
| M3 | `phase-03-affiliate-link-injection.md` | 3d | ~900 (1 migration + 7 lib files + 2 telegram FSM + UI form + 3 tests) |
| M4 | `phase-04-conversion-attribution.md` | 1d | ~600 (1 migration + 5 lib files + webhook route + 4 tests) |
| M5 | `phase-05-user-wallet-payout.md` | 1d | ~1200 (1 migration + 8 lib/cron files + 4 UI files + 6 tests) |

**Total Sprint M effort:** ~6.5 days
**Total LOC (impl + test):** ~3050

## Dependency graph

```
M1 (D1 migrations + CF Secrets)
  └─→ M2 (kill mock fraud — needs keys present)
       └─→ M3 (affiliate link injection — needs real script + campaigns table)
            └─→ M4 (conversion attribution — needs click logger from M3)
                 └─→ M5 (wallet payout — needs conversions from M4)
```

Strict sequential execution. No parallelization within Sprint M (each phase depends on prior phase's data model + runtime).

## Risk hotspots

1. **M1 Telegram handler refactor** — replacing Supabase with D1 in active path; rollback plan required
2. **M3 Telegram FSM extension** — 3-step flow (topic→audience→offer) doubles UX complexity; risk: state loss mid-flow
3. **M3 short-link p95 latency** — must stay <50ms; D1 indexed lookup + fire-and-forget click log
4. **M4 ClickBank `cvendthru` truncation** — `tid` must fit 24 chars; UUID is 36; need UUIDv7 or store both forms
5. **M4 60-day refund window** — `payout_status='pending_clearance'` until cleared; misconfiguration → premature payout → loss
6. **M5 mark-paid atomicity** — race conditions on concurrent admin clicks; D1 batch() must be used
7. **CF Secret rotation** — M1 sets 8 secrets; any rotation requires synchronized update to external service (NOWPayments dashboard, ClickBank dashboard, Telegram BotFather)

## Assumptions made (no user blocking)

1. **Affiliate network MVP = ClickBank** — already integrated for discovery; INS postback is simplest
2. **Revenue split = 70% user / 30% Sophia** — industry standard for creator monetization platforms
3. **Inngest hosting = Inngest Cloud** — Cloudflare Workers cannot host Inngest dev server
4. **Min payout = $50** — industry standard threshold balancing admin overhead vs user satisfaction
5. **Payout method MVP = manual admin via dashboard** — automation deferred to Sprint M+1
6. **Clearance window = 60 days** — matches ClickBank's refund policy
7. **Telegram FSM persistence reuses existing `telegram-fsm-state-manager.ts`** — D1-backed, already production-ready
8. **Bilingual VI+EN messages** per `sophia-handover-rules.md` (non-tech CEO + Vietnamese market)

## Schema additions (4 migrations)

| File | Tables added |
|------|--------------|
| `0018-campaigns.sql` | `campaigns`, `campaign_checkpoints` |
| `0019-raas-licenses.sql` | `raas_licenses`, `raas_audit_logs` |
| `0020-affiliate-offers-selected.sql` | `affiliate_offers_selected`, `affiliate_clicks` |
| `0021-affiliate-conversions.sql` | `affiliate_conversions` |
| `0022-user-wallets-payouts.sql` | `user_wallets`, `payouts`, `user_payout_settings` |

All schemas adapted from Supabase → D1 (no `gen_random_uuid`, no `jsonb`, no RLS, no triggers; uses TEXT/INTEGER/JSON-text + CHECK constraints).

## CF Secrets to set (8 in M1 + 1 in M4)

```
OPENROUTER_API_KEY ELEVENLABS_API_KEY HEYGEN_API_KEY
NOWPAYMENTS_API_KEY NOWPAYMENTS_IPN_SECRET
TELEGRAM_BOT_TOKEN INNGEST_SIGNING_KEY INNGEST_EVENT_KEY
CLICKBANK_INS_SECRET (M4)
```

## Cron triggers added (2 in M5)

```
0 * * * *   /api/cron/wallet-rebuild       (hourly: rebuild user_wallets from conversions)
0 0 * * *   /api/cron/clearance-promote    (daily: promote pending → available after 60d)
```

## Out of scope (Sprint O — observability)

- Public revenue dashboard
- Per-user wallet history view (full timeline)
- Webhook receipt confirmation log table
- Multi-network support (ShareASale, Amazon, CJ) — only ClickBank in M
- Automated USDT mass-payout (manual admin in M)
- User wallet address verification (proof-of-ownership)
- Multi-currency support (USD-only in M)

## Questions for user

1. Does `users` D1 table have rows for current paying customers (Better Auth seeded), or empty? If empty, FK insert fails on first /campaign — may need data backfill in M1.
2. Who is the first admin user? `paid_by_admin` field needs lookup mechanism — recommend resolving by env `ADMIN_USER` email lookup at runtime.
3. ClickBank vendor account ownership — who has dashboard access to set INS URL + secret? Required for M4 step 9.
4. Admin Telegram handle for refund instructions in M2 — placeholder is `@sophia_support`; need actual handle.
5. Should mock mode be auto-disabled in production via separate guard (e.g., reject `NEXT_PUBLIC_MOCK_AI_SERVICES=true` at app boot in prod)?
6. Existing cron auth pattern — `CRON_SECRET` env or Cloudflare cron header? M5 cron endpoints need to follow same pattern as `api/cron/uptime-check`.
7. Currency normalization — should ClickBank non-USD payouts convert to USD at conversion time, or only at payout time?
8. Sprint O scope — should public revenue dashboard ship same week, or after Sprint M proves first dollar?

## Files created

```
plans/260427-0306-sprint-m-revenue-path/plan.md
plans/260427-0306-sprint-m-revenue-path/phase-01-unblock-pipeline.md
plans/260427-0306-sprint-m-revenue-path/phase-02-kill-mock-fraud.md
plans/260427-0306-sprint-m-revenue-path/phase-03-affiliate-link-injection.md
plans/260427-0306-sprint-m-revenue-path/phase-04-conversion-attribution.md
plans/260427-0306-sprint-m-revenue-path/phase-05-user-wallet-payout.md
plans/reports/planner-260427-0306-sprint-m-plan.md (this file)
```
