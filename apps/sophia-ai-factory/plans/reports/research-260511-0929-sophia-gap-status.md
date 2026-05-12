---
title: "Sophia GAP Plan — Status Research"
date: 2026-05-11 09:29 PT
type: research
plan_ref: ~/plans/260510-0603-sophia-gap-plan/
prod_sha: 7e9e8749 (2026-05-11T15:19:52Z)
prod_status: HTTP 200 OK
---

# Sophia GAP Plan — Status Research (2026-05-11)

## Executive Summary

GAP plan đã **đóng phần lớn code-level work** trong 1.5 ngày (8 phase × 1 session 2026-05-10, follow-ups 2026-05-11). Production live SHA `7e9e8749`, 14/14 phase shipped + GAP phases 01–08 ở trạng thái **code-complete hoặc partial-with-clear-defer**. Còn lại chủ yếu là **operational provisioning + business execution**, không phải code.

**Bottom line:** code GAP gần như đã đóng — đường tới $1M ARR giờ là execution gap (Stripe dashboard secrets, first affiliate partners, PH/HN launch), không phải engineering gap.

---

## Phase Status Matrix (2026-05-11)

| Phase | Title | GAP | Status | Còn lại |
|---|---|---|---|---|
| 01 | Observability | GAP-1 | ✅ CODE COMPLETE 2026-05-10 | env secrets + backup drill (ops) |
| 02 | E2E + Load | GAP-1 | ✅ GREEN 100/106 pass + k6 done 2026-05-10 | k6 p95 above 500ms target (⚠️ perf gap), load report archive |
| 03 | Stripe Connect KYC | GAP-2 | ⚠️ BACKEND + UI + CRON LIVE 2026-05-11 | Stripe dashboard user-action (secrets, webhook URL) + E2E spec |
| 04 | Affiliate Onboarding | GAP-5 | ⚠️ ~70% 2026-05-10 | dashboard polish + asset pack + first 5 partners (ops) |
| 05 | Growth Launch | GAP-5 | ⚠️ PARTIAL 2026-05-10 | PH/HN execution + Twitter thread (ops) |
| 06 | GPU + Fly.io | GAP-3 | ⚠️ ~80% PRE-BUILT 2026-05-10 | actual Fly deploy + Runpod template (defer P2) |
| 07 | Product Depth | GAP-6 | ⚠️ PARTIAL 2026-05-10 | templates seeding + dashboard UI + Zapier (defer) |
| 08 | Team & Process | GAP-7 | ⚠️ ~70% PRE-BUILT 2026-05-10 | hiring/contractor (gated $5K MRR) |

---

## Real Remaining Blockers to Revenue

### 🔴 Critical (Blocks $1 revenue)
1. **P03 Stripe Connect user-actions**: provision platform, register webhook URL, set `STRIPE_SECRET_KEY` + `STRIPE_CONNECT_WEBHOOK_SECRET`. Code 100% ready — chỉ cần Stripe dashboard ops (~30min user action).
2. **P04 First 5 affiliate partners**: 0 paying. Pipeline tech sẵn (referral codes, drip emails, lifecycle rules) nhưng cần manual outreach.

### 🟡 High Impact
3. **P05 Launch execution**: PH submission + HN Show post + Twitter thread. Copy ready ở `docs/launch/`.
4. **P02 Perf gap**: k6 baseline shows p95 3.46s (steady) / 6.78s (spike) — above 500ms target. Cần tune Inngest concurrency hoặc add CDN cache layer.

### 🟢 Nice-to-have (Defer)
5. **P07 Templates + Zapier** — gate behind 1 paying customer
6. **P06 Fly + Runpod rollout** — gate behind HQ-video demand
7. **P08 Contractor hire** — gate $5K MRR

---

## Code Stack State (Verified 2026-05-11)

| Metric | Value |
|---|---|
| Production SHA | `7e9e8749` |
| Deploy time | 2026-05-11T15:19:52Z |
| HTTP | 200 OK |
| OpenNext | 1.17.3 |
| Deploy doctrine | CF-direct (`npm run deploy:full`) since 2026-05-03 |
| Tests | ~2073 pass + E2E 100/106 + k6 baseline done |
| TS type-debt | active cleanup — 25 `as any` sites closed this session (test/type-only commits, no deploy) |

---

## Recommendations (Sprint Priorities — Next 7 Days)

### Day 1-2 — Revenue Unlock 🔴
- [ ] User action: Stripe Connect Standard activation + webhook URL setup
- [ ] Smoke-test affiliate payout flow end-to-end (1 test transaction)
- [ ] Write `e2e/affiliate-payout-flow.spec.ts` (USDT + Stripe paths)

### Day 3-4 — Growth Kickoff 🟡
- [ ] Manual outreach: 10 target affiliate creators (DM/email)
- [ ] Capture PH asset pack (3 GIFs + 5 screenshots via Loom/Playwright)
- [ ] Schedule PH launch date + HN Show post

### Day 5 — Perf Gap 🟡
- [ ] Profile k6 spike run, identify bottleneck (D1 read? OpenNext cold start?)
- [ ] Tune Inngest concurrency or add HTTP cache headers
- [ ] Re-baseline k6 steady, target p95 < 1s

### Day 6-7 — Follow-up
- [ ] Backup restore drill (D1) — operational item from Phase 01
- [ ] Archive k6 load reports under `plans/reports/k6-260511-*-baseline.md`
- [ ] Continue test type-debt cleanup (audit test files: 9-43 sites each)

---

## Type-Debt Cleanup Progress (Background Track)

5 slices this session, 25 `as any` sites closed, all test/type-only (no deploy needed):
- `d6bb606e` usage-metering idempotency widen (2)
- `0efa43b3` telegram-bot vi.mocked + lastUpdated (3)
- `9a5ff00d` jwt-validator Uint8Array (6)
- `d11ef075` compute-next Extract narrow (7)
- `1612c5d8` crypto-utils widen + named cast (7)

**Next candidates (smallest-blast-radius first):**
- 9 sites: `src/tree/audit/report-delivery.test.ts`
- 12 sites: `src/tree/audit/audit-query-logger.test.ts`
- 19 sites: `src/tree/audit/report-scheduler.test.ts`
- 19 sites: `src/seed/auth/jwt-nonce-tracker.test.ts`
- 32 sites: `src/app/api/internal/usage/query/internal-usage-query.test.ts`
- 32 sites: `src/app/api/v1/usage/batch/batch-ingestion-api.test.ts`
- 43 sites: `src/app/api/violations/route.test.ts`

---

## Success Metrics — Are We Tracking?

| Original 4-week target | Status 2026-05-11 |
|---|---|
| CI/CD GREEN rate 95%+ | N/A — CF-direct doctrine, GH Actions archived |
| E2E coverage 12 scenarios | ✅ 16 spec files (100/106 pass) |
| Uptime 99.5% | ❓ no public uptime dashboard; `/api/health` + cron only |
| Affiliate partners 10+ | 🔴 0 onboarded |
| Videos generated 100+ | ❓ no metric exposed |
| Revenue $1K MRR | 🔴 $0 (no paying customers) |
| p95 video schedule < 50ms | ❓ video schedule perf untested; k6 public-route p95 3.46s |

---

## Unresolved Questions

1. **Stripe Connect activation timing** — user-action gated, no ETA committed
2. **First-partner outreach strategy** — DM/email/Twitter? Who's the target persona?
3. **PH/HN launch date** — need calendar commitment + asset capture session
4. **k6 perf root cause** — D1, OpenNext cold start, or downstream API? Need profiling pass
5. **Uptime dashboard** — Better Stack ($) vs DIY status page (already partially built)?
6. **Type-debt continuation** — keep cleaning audit-domain tests, or pivot to feature work?
7. **Phase plan refresh** — when to mark GAP plan "execution mode" vs keep adding phases?
