---
title: "Go-Live 100 Fixes Sprint"
description: "Multi-tier security & observability improvements for Sophia AI Factory. Target: score 83 → 92/100."
status: in_progress
priority: P1
effort: 32h
branch: main
tags: [tier-2, security, observability, performance, devops]
created: 2026-04-28
---

# Plan — Go-Live 100 Fixes Sprint

## Context
- Baseline score: ~83/100 (6 months post-MVP, pre-scale)
- Target: 92/100 (enterprise production-ready)
- Stack: Next.js 16 + Cloudflare Workers + D1 + Better Auth + NOWPayments
- Deploy: GitHub Actions → `Tests & Deploy` workflow → wrangler deploy
- Prod: https://sophia.agencyos.network

## Phase Map
| # | Phase | File | Effort | Status |
|---|-------|------|--------|--------|
| 01 | TIER-1 core fixes (462 TS errors, type safety) | [phase-01-tier1-core.md](./phase-01-tier1-core.md) | 8h | pending |
| 02 | TIER-2 sub-phases (A-J: MFA, CSP, CSRF, etc) | [phase-02-tier2-backlog.md](./phase-02-tier2-backlog.md) | 16h | in_progress |
| 02.D | TIER-2D Sentry observability | [../260428-2141-tier2d-sentry-observability/plan.md](../260428-2141-tier2d-sentry-observability/plan.md) | 4h | ✅ Completed 2026-04-28 |
| 03 | TIER-3 performance + CDN + DR | [phase-03-tier3-scale.md](./phase-03-tier3-scale.md) | 6h | pending |
| 04 | Verification + deploy + handoff | [phase-04-verification-deploy.md](./phase-04-verification-deploy.md) | 2h | pending |

## Key Dependencies
- Phase 02 (Tier-2 sub-phases) include security + observability
- Phase 02.D (TIER-2D) completes 1st observability layer; others (TIER-2A TS, TIER-2C MFA, etc.) deferred to later sprints
- All phases must maintain green CI/CD + zero regressions (Setup Wizard, Telegram Bot, NOWPayments IPN)

## Success Criteria (rolled up)
- Score: 83 → ≥92/100 (cumulative across completed phases)
- Build: `npm run build` exit 0; Tests: `npm test` 100% pass
- CI/CD: `Tests & Deploy` workflow fully green (both jobs success)
- Production: /api/version SHA match verified; HTTP 200; health probes all green
- Protected flows intact: Setup Wizard, Telegram Bot (@Sophia_Bbot), NOWPayments IPN
- Zero `:any` types; all files ≤200 LOC; zero tech debt TODOs left behind

## Progress Snapshot
- **Phase 01 (TIER-1):** pending — 462 TS errors deferred to next sprint
- **Phase 02 (TIER-2):** in_progress
  - TIER-2D ✅ COMPLETED 2026-04-28 (Sentry observability; +5 score lift)
  - TIER-2A (462 TS errors), TIER-2C (MFA), TIER-2E (CSP nonce), TIER-2F (cron migrate), TIER-2G (CSRF), TIER-2H (data quality), TIER-2I (DR), TIER-2J (DNS/R2/GH) — deferred
- **Phase 03 (TIER-3):** pending
- **Phase 04 (Verification):** pending

## Risk Snapshot
- **R1 — TS error volume:** 462 errors remain; deferring to next sprint
- **R2 — Sentry provisioning:** DSN/auth tokens must be set by user post-deploy
- **R3 — KV/R2 sentinels:** one-time pre-seed required for health probes
- **R4 — Regressions:** every merge must test protected flows (Setup Wizard, Telegram Bot, IPN)

## Unresolved Questions
1. Should Tier-2 sub-phases (A, C, E, F, G, H, I, J) be parallelized or sequential?
2. Phase 03 (TIER-3) scope — CDN caching rules, DB query optimization, RTO/RPO definition?
3. Handoff timeline — when does client take ownership of Sentry/Cloudflare monitoring?
