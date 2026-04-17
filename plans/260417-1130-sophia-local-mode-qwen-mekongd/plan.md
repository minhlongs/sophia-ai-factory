---
title: "Sophia Local Mode (Qwen 3.6 + mekongd)"
description: "Route Sophia LLM calls to customer-owned mekongd on M1 Max via Cloudflare Tunnel (BYOK, edge-safe, fallback-on-failure)"
status: in-progress
priority: P1
effort: 9d (Phase A: 1d this iteration; Phases B-F: 8d deferred)
branch: master
tags: [sophia, byok, local-mode, mekongd, qwen, a16z-solo, edge]
created: 2026-04-17
---

# Sophia Local Mode — Qwen 3.6 + mekongd

## Goal
Enable Sophia to route LLM inference to a customer-owned mekongd instance running Qwen 3.6-35B-A3B on M1 Max via Cloudflare Tunnel. BYOK pattern, edge-safe, silent fallback to OpenRouter on failure.

## Strategy
- **Phase A — eat-own-dogfood (THIS ITERATION):** founder's Sophia → founder's M1 Max via existing `m1max-cf` tunnel. Validates loop end-to-end before any customer build.
- **Phases B-F — DEFERRED:** customer-facing implementation (per-user opt-in, encryption, auto-installer, UI, monitoring). Skeletons hydrated; next-session planner can pick up without re-research.

## Reuses just-shipped infra
- BYOK timeout wrapper: `apps/sophia-ai-factory/src/lib/byok/with-timeout.ts`
- D1 signals + `track`: emits `byok_call` w/ provider tag for telemetry
- KV feature flag helper (Phase 4): `% rollout` for Phase B

## Phase Status

| # | Phase | Effort | Status | Depends |
|---|---|---|---|---|
| A | Eat-own-dogfood (founder M1 Max → founder Sophia) | 1d | pending | — |
| B | Customer BYOK adapter + provider router | 2d | complete | A, C |
| C | D1 encryption helper (AES-GCM via crypto.subtle) | 1d | complete | A |
| D | Auto-installer + tunnel provision | 3d | deferred | B, C |
| E | Setup wizard "Local Mode" UI tab | 1-2d | deferred | D |
| F | Health monitoring cron + customer docs | 1d | deferred | D |

## Dependency Graph
```
A ──┬── B ──┐
    └── C ──┴── D ── E
                 └── F
```

## Files
- `phase-A-eat-own-dogfood.md` — full standard sections (ship now)
- `phase-B-customer-byok-adapter.md` — skeleton, deferred
- `phase-C-d1-encryption-helper.md` — skeleton, deferred
- `phase-D-auto-installer-tunnel.md` — skeleton, deferred
- `phase-E-setup-wizard-ui.md` — skeleton, deferred
- `phase-F-health-monitoring-docs.md` — skeleton, deferred

## Source Reports
- `plans/reports/researcher-260417-1147-qwen36-mekongd-integration-recipe.md`
- `plans/reports/researcher-260417-1130-sophia-local-mode-architecture.md`
- `plans/reports/synthesis-260417-1130-sophia-local-mode.md`

## Founder Decisions (Final)
- First customer-facing route: `affiliate-openrouter-niche-enhancer.ts`
- Phase A only this iteration; B-F next iteration
- Failure mode: silent fallback to OpenRouter (no user notification)
- Compliance: edge-only, no Polar, NOWPayments path unchanged
