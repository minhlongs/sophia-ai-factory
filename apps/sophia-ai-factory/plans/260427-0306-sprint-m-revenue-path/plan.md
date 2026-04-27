---
title: "Sprint M — First-Dollar Revenue Path"
description: "Unblock 6-stage revenue pipeline so a real user paying USDT can earn first affiliate commission."
status: pending
priority: P1
effort: 6.5d
branch: main
tags: [revenue, affiliate, d1-migration, payments, telegram-bot]
created: 2026-04-27
---

# Sprint M — First-Dollar Revenue Path

**Goal:** Make first dollar of real revenue flow through Sophia AI Factory.
**Verdict from synthesis (2026-04-27):** Tech debt = 0. Revenue = $0. Six gaps block monetization. Stop polishing — ship the engine.

## Source reports
- `plans/reports/synthesis-260427-0250-revenue-pipeline-reality-check.md` — gap matrix + fix sequence
- `plans/reports/researcher-260427-0250-track-01-e2e-pipeline-audit.md`
- `plans/reports/researcher-260427-0250-track-02-revenue-visibility-audit.md`
- `plans/reports/researcher-260427-0250-track-03-affiliate-attribution-audit.md`

## Phases

| # | Phase | Effort | Status | Blocks |
|---|-------|--------|--------|--------|
| M1 | Unblock pipeline (D1 migrations + env vars) | 1d | code-shipped (deploy + secrets pending) | M2..M5 |
| M2 | Kill ServiceFactory auto-mock fraud | 0.5d | pending | M3..M5 |
| M3 | Affiliate link injection (offer selector + short-link + click log) | 3d | pending | M4 |
| M4 | Conversion attribution (ClickBank postback + commission calc) | 1d | pending | M5 |
| M5 | User wallet + manual payout dashboard | 1d | pending | — |

**Total:** ~6.5 days for first paying user → first commission earned.

## Phase files
- [phase-01-unblock-pipeline.md](./phase-01-unblock-pipeline.md) — `campaigns` + `raas_licenses` D1 migrations + wrangler vars + CF Secrets
- [phase-02-kill-mock-fraud.md](./phase-02-kill-mock-fraud.md) — `MissingCredentialsError` in production + Telegram refund flow
- [phase-03-affiliate-link-injection.md](./phase-03-affiliate-link-injection.md) — `affiliate_offers_selected` + `/api/r/[code]` + script CTA injection
- [phase-04-conversion-attribution.md](./phase-04-conversion-attribution.md) — ClickBank postback receiver + 70/30 commission calc
- [phase-05-user-wallet-payout.md](./phase-05-user-wallet-payout.md) — `user_wallets` + admin manual payout MVP

## Dependencies
- M1 → M2 → M3 → M4 → M5 (strict sequence; later phases depend on schema + non-mock pipeline)
- M3 needs `campaigns` table (M1) + real script generation (M2) before injection makes sense
- M4 needs M3 short-link clicks logged (no clicks → no conversions to attribute)
- M5 needs M4 conversions calculated (no commissions → empty wallet)

## Key assumptions (defaults — no user blocking)
1. **Affiliate network MVP = ClickBank** — already integrated for discovery; postback URL setup is simplest
2. **Revenue split = 70% user / 30% Sophia** — industry standard for creator monetization platforms
3. **Inngest hosting = Inngest Cloud** — Cloudflare Workers cannot host long-running Inngest dev server

## Out of scope (Sprint O — observability)
- Public revenue dashboard
- Per-user wallet history view
- Webhook receipt confirmation log
- Multi-network postback (ShareASale/CJ/Awin) — deferred until ClickBank proven
- Automated payout to USDT/bank — manual admin approval suffices for first $1

## Success criteria for Sprint M
1. Real USDT payment received by NOWPayments → tier activated (M1)
2. /campaign in Telegram triggers pipeline → real script + voice + video produced (M1+M2)
3. Video description contains tracked short-link → CTR logged in `affiliate_clicks` (M3)
4. ClickBank postback received → row in `affiliate_conversions` with attributed userId (M4)
5. User wallet balance reflects 70% commission → admin can mark payout sent (M5)
