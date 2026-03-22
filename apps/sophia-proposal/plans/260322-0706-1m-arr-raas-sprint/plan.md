---
title: "$1M ARR RaaS Sprint — Phase 4-5"
description: "TypeScript cleanup, Supabase removal, Sales commands, SDK, monitoring, M1 sync"
status: pending
priority: P1
effort: 16h
branch: master
tags: [raas, sales, sdk, monitoring, cleanup]
created: 2026-03-22
---

# $1M ARR RaaS Sprint — Phase 4-5

**Goal:** Ship cleanup + 5 sales commands + SDK + monitoring toward $1M ARR
**Baseline:** 72 routes GREEN, 183 tests PASS, 9 commands, 100% Cloudflare

## Phases

| # | Phase | Priority | Effort | Status | Deps |
|---|-------|----------|--------|--------|------|
| 1 | [TypeScript Cleanup](./phase-01-typescript-cleanup.md) | P1 | 2h | pending | — |
| 2 | [Supabase Remnants Cleanup](./phase-02-supabase-remnants-cleanup.md) | P1 | 1h | pending | — |
| 3 | [OpenClaw Sales Commands](./phase-03-openclaw-sales-commands.md) | P1 | 5h | pending | 1,2 |
| 4 | [RaaS SDK + API Docs](./phase-04-raas-sdk-api-docs.md) | P2 | 4h | pending | 3 |
| 5 | [Production Monitoring](./phase-05-production-monitoring.md) | P2 | 2h | pending | 1,2 |
| 6 | [M1 Max Sync + Smoke Tests](./phase-06-m1-max-sync-smoke-tests.md) | P2 | 2h | pending | 1-5 |

## Key Dependencies

- Polar.sh billing working (DONE)
- OpenClaw PEV engine working (DONE)
- D1 client layer working (DONE)
- `next.config.js` still refs `@supabase/supabase-js` (Phase 2 removes)

## Success Criteria

- 0 `any` types, 0 `ignoreBuildErrors`, 0 Supabase imports
- 14 commands (9 existing + 5 new sales)
- `@sophia/raas-sdk` publishable, OpenAPI spec at `/docs/api`
- CF Analytics + health endpoint live
- 200+ tests PASS

## Key Metrics Target

| Metric | Current | Sprint Target |
|--------|---------|---------------|
| Commands | 9 | 14 |
| Tests | 183 | 200+ |
| Routes | 72 | 80+ |
| `any` types | ~0 | 0 |
| Monitoring | none | CF Analytics + /health |
