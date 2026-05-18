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

**Progress:** 1/10 phases (10%) — Phase 01 audit complete 2026-05-17.

**Brainstorm:** [reports/brainstorm.md](reports/brainstorm.md)
**Production:** https://sophia.agencyos.network (HEAD `05b62157`)
**Doctrine:** [.claude/rules/sophia-no-tech-doctrine.md](../../.claude/rules/sophia-no-tech-doctrine.md) v1.28.1 — no operator third-party setup, NOWPayments-only, BYOK customer side.

## Audit Baselines (Phase 01)
- Tests: **4,446 pass** + 32 skip / 4,478 total (prior memory: 1,444 — stale)
- Lint: **0 errors, 340 warnings** (prior: 423w — improved -83)
- PROD HEAD: `05b62157` matches local clean state
- FREE100 base seed: 1 active row in PROD D1 (code=FREE100, 50 slots, valid until 2026-07-30)
- Worktree archived; 4 salvaged scripts moved to canon (deploy/verify/e2e scripts)
- No blockers for Phase 02

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
| 04 | [Admin UI Bulk Codes + Search/Filter](phase-04-admin-ui-bulk-codes.md) | D4 | pending | 03 |
| 05 | [Pen Test Part A — Automated + Auth/Promo](phase-05-pentest-part-a-automated-and-auth-promo.md) | D5-D6 | pending | 02, 04 |
| 06 | [Pen Test Part B — Billing + Remediation](phase-06-pentest-part-b-billing-and-remediation.md) | D7 | pending | 05 |
| 07 | [DR Drill Restore on Staging](phase-07-dr-drill-restore.md) | D8 | pending | 02 |
| 08 | [Load Test + Playwright E2E Magic Link](phase-08-load-test-and-playwright-e2e.md) | D9 | pending | 02, 04 |
| 09 | [Handover Docs Consolidation](phase-09-handover-docs-consolidation.md) | D9 (parallel) | pending | 06, 07 |
| 10 | [Training Video + Final Sign-off](phase-10-training-video-and-final-signoff.md) | D10 | pending | 08, 09 |

## Key Dependencies
- Phase 02 (staging) is hard-blocker for 05, 07, 08
- Phase 04 (admin UI) is blocker for E2E in 08 + training video in 10
- Phase 09 can run parallel with 08 if pen test (06) + DR (07) done
- Phase 10 is final gate — requires ALL prior phases green

## Realistic Score Uplift
- **Pre-work:** 87.5/100 (doctrine ceiling per memory `project_sophia_consolidation`)
- **Post-work target:** 92-94/100 — DR drill executed + load test passed + pen test ASVS L2 report + Playwright E2E
- **Beyond 94:** requires months of monthly DR drills (doctrine lock — out of scope)

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
