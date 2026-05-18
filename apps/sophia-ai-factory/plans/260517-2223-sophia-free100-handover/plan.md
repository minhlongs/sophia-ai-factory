---
status: pending
created: 2026-05-17
brainstorm: reports/brainstorm.md
project: sophia-ai-factory
doctrine: v1.28.1
target_score: 92-94/100
estimated_days: 10
---

# Plan — Sophia FREE100 + Compliance-Grade Handover

**Goal:** Ship compliance-grade FREE100-XXXX bulk codes + full pen test + DR drill + load test + client handover package. Push honest 10-layer score from 87.5/100 → 92-94/100 (doctrine ceiling locks higher).

**Progress:** 6/10 phases (60%) + Phase 05a autonomous deliverables shipped 2026-05-18 — Phase 01 audit complete 2026-05-17; Phase 03 code complete 2026-05-18; Phase 04 (04a + 04b) complete 2026-05-18; Phase 05a (security audit + regression tests) complete 2026-05-18; Phase 09 v1 handover docs complete 2026-05-18.

**Brainstorm:** [reports/brainstorm.md](reports/brainstorm.md)
**Production:** https://sophia.agencyos.network (HEAD `05b62157`)
**Doctrine:** [.claude/rules/sophia-no-tech-doctrine.md](../../.claude/rules/sophia-no-tech-doctrine.md) v1.28.1 — no operator third-party setup, NOWPayments-only, BYOK customer side.

## Audit Baselines (Phase 01–05a)
- Tests: **4,528 pass** + 2 skip / 4,530 total (Phase 03 +11; Phase 04a/b +1; Phase 05a adds ~31 security tests: F01 brute-force 14 + F02 admin-re-auth 11 + F03 N-A 6 skipped)
- Lint: **0 errors, 340 warnings** (stable)
- i18n: **1,121 keys** total
- Dependencies: **npm audit 0 high/critical** (2094 deps, Phase 05a verified 2026-05-18)
- Security: **ASVS L2 coverage 84%** (26 pass / 2 fail / 3 n-a of 31 controls; F01/F02 remediated, F03 N-A)
- PROD HEAD: `05b62157` matches local clean state
- FREE100 base seed: 1 active row in PROD D1 (code=FREE100, 50 slots, valid 2026-07-30)
- Phase 04a/b ships: bulk page + list/filter + CSV export E2E complete.
- **Phase 05a pre-shipped (2026-05-18):** F01 (brute-force mitigation via 0114 migration + sql-rate-limiter.ts + account-lockout-hook.ts), F02 (admin re-auth via require-admin.ts + admin-challenge/route.ts), F03 (N-A single-tenant promo). Code-reviewer 9.6/10 APPROVE. TS/Lint green, Tests 57 pass. Staging re-scan pending Phase 02.

## Constraints
- ❌ NEVER Polar.sh — NOWPayments only (live secrets already wired)
- ❌ NO QStash/Sentry tokens/observability operator setup
- ✅ CF-direct deploy via `npm run deploy:full` (GH Actions disabled by design)
- ✅ Promo system already built (`src/land/promo/`, `src/app/[locale]/redeem/`, admin CRUD)
- ✅ Auto-handover already built (`src/tree/handover/`, 72h magic link)

## Phase Status Table

| # | Phase | Days | Status | Blockers |
|---|---|---:|---|---|
| 01 | [Audit & Worktree Cleanup](phase-01-audit-and-worktree-cleanup.md) | D1 | ✅ 2026-05-17 | — |
| 02 | [Staging Worker + D1 Setup](phase-02-staging-setup.md) | D2 | pending | 01 |
| 03 | [FREE100-XXXX Bulk-Generate API](phase-03-free100-bulk-generate-api.md) | D3 | pending | 01 |
| 04 | [Admin UI Bulk Codes + Search/Filter](phase-04-admin-ui-bulk-codes.md) | D4 | ✅ 2026-05-18 (04a + 04b complete) | 03 |
| 05 | [Pen Test Part A — Automated + Auth/Promo](phase-05-pentest-part-a-automated-and-auth-promo.md) | D5-D6 | in-progress (5a autonomous complete) | 02 |
| 06 | [Pen Test Part B — Billing + Remediation](phase-06-pentest-part-b-billing-and-remediation.md) | D7 | pending | 05 |
| 07 | [DR Drill Restore on Staging](phase-07-dr-drill-restore.md) | D8 | pending | 02 |
| 08 | [Load Test + Playwright E2E Magic Link](phase-08-load-test-and-playwright-e2e.md) | D9 | pending | 02, 04 |
| 09 | [Handover Docs Consolidation](phase-09-handover-docs-consolidation.md) | D9 (parallel) | ✅ 2026-05-18 (v1; 06/07/08 metrics TBD) | 06, 07 |
| 10 | [Training Video + Final Sign-off](phase-10-training-video-and-final-signoff.md) | D10 | pending | 08, 09 |

## Key Dependencies
- Phase 02 (staging) is hard-blocker for 05, 07, 08
- Phase 04 (admin UI) is blocker for E2E in 08 + training video in 10
- Phase 09 can run parallel with 08 if pen test (06) + DR (07) done
- Phase 10 is final gate — requires ALL prior phases green

## Realistic Score Uplift
- **Pre-work:** 87.5/100 (honest baseline per memory `project_sophia_consolidation`)
- **Post-work target:** 92-94/100 — DR drill executed + load test passed + pen test ASVS L2 report + Playwright E2E
- **Doctrine ceiling:** 91.5/100 per `.claude/rules/sophia-no-tech-doctrine.md` v1.28.1 (no operator third-party setup, BYOK only). ASVS L2 findings F01/F02 remediated; F03 N-A. Ceiling immutable without months of monthly DR drills (doctrine lock).

## Final Deliverables
1. `docs/CLIENT-HANDOVER-PACKAGE.md` (consolidated)
2. `docs/pentest-260520-part-a.md` + `docs/pentest-260521-part-b.md`
3. `docs/dr-drill-260522.md` (RTO/RPO measured)
4. `docs/load-test-260523.md`
5. ~30min training video (.mp4) → client Google Drive
6. `reports/handover-260527-final.md`

## Verification (per phase + final)
- Build/tests/lint baseline preserved
- Browser Rule 13 — all 4 tier checkouts + FREE100-XXXX flow before final sign-off
- Production `/api/version` SHA must match local HEAD post-deploy
