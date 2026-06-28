---
title: "TIER-2D — Observability Platform (Sentry)"
description: "Sentry SDK + source maps + health probes + logger consolidation; lifts score 83 → 88."
status: completed
priority: P2
effort: 4h
branch: main
tags: [observability, sentry, apm, health, logger, tier-2d]
created: 2026-04-28
completed: 2026-04-28
---

# Plan — TIER-2D Sentry Observability

## Context
- Source spec: `plans/260428-0253-go-live-100-fixes/phase-02-tier2-backlog.md` § TIER-2D (lines 77-87)
- Stack: Next.js 16 + OpenNext (Cloudflare Workers) + D1 + R2 + Better Auth + NOWPayments
- Deploy: `Tests & Deploy` workflow → `wrangler deploy` (CF Workers, NOT Vercel)
- Current `/api/health`: returns Supabase + Redis + service-config; missing D1 / R2 / KV pings.
- Residual `console.error`: 5 calls (worker queue x2, error.tsx x1, logger-internals x1 [legit], coupons x1)
- No Sentry deps yet (verified `package.json`).

## Goal
Production-grade error tracking + APM. Score uplift ~83 → ~88 (+5). MUST NOT break Setup Wizard / Telegram Bot / NOWPayments IPN.

## Phase Map
| # | Phase | File | Effort | Status |
|---|-------|------|--------|--------|
| 01 | Sentry SDK install + config (client/server/edge + instrumentation.ts) | [phase-01-implement-sentry-sdk.md](./phase-01-implement-sentry-sdk.md) | 1.5h | ✅ Completed 2026-04-28 |
| 02 | Source maps + CI upload + manual deploy fallback | [phase-02-source-maps-and-deploy.md](./phase-02-source-maps-and-deploy.md) | 1h | ✅ Completed 2026-04-28 |
| 03 | `/api/health` D1/R2/KV pings + logger consolidation | [phase-03-health-and-logger.md](./phase-03-health-and-logger.md) | 1.5h | ✅ Completed 2026-04-28 |

## Key Dependencies
- `@sentry/nextjs` ≥ v8.x (edge runtime support via `instrumentation.ts`)
- `sentry-cli` (CI source-map upload)
- `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` (CF Worker secrets + GH secrets)
- Existing `@/lib/utils/logger-utility` (target for console.error replacements)

## Success Criteria (rolled up)
- `npm run build` exit 0; `npm test` 100% pass
- 0 `:any` types added; all files ≤200 LOC
- Sentry captures: client error + server error + edge error (smoke test 3 events)
- `/api/health` returns `{ db, kv, r2, sha, deployedAt }` with bounded latency (<2s)
- 0 `console.error` in app code (worker queue + error.tsx + coupons replaced; logger-internals remains)
- No regression: Setup Wizard, Telegram Bot, NOWPayments IPN all green post-deploy
- Production verification: SHA match + HTTP 200 (per `sophia-deploy-verify.md`)

## Risk Snapshot
- **R1 — Edge-runtime incompat:** Sentry SDK may not load on CF Workers edge. Mitigation: use `@sentry/nextjs` v8 instrumentation pattern; fallback to manual `Sentry.captureException` in catch blocks if instrumentation fails.
- **R2 — Bundle size bloat:** Sentry adds ~80KB. Mitigation: tree-shake unused integrations, sample 10% prod traces.
- **R3 — Source-map leak:** Source maps must NOT ship to client. Mitigation: `hideSourceMaps: true` in `withSentryConfig`.
- **R4 — Deploy SHA breakage:** Source map uploads must use commit SHA. Mitigation: pass `SENTRY_RELEASE=$COMMIT_SHA` in CI.

## Unresolved Questions
- KV binding name: confirm `SOPHIA_KV` / `SESSION_KV` / other? (check `wrangler.toml`)
- R2 sentinel object path for HEAD ping — propose `health-check.txt` in `sophia-ai-factory-opennext-cache`
- Sentry org/project names — to be provisioned by client (placeholder `sophia-ai-factory`)
