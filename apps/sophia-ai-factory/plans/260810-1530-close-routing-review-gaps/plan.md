---
title: "Close OmniRoute Routing Review Gaps"
description: "Fix missing direct strategy tests, bilingual progress emission on NoProvidersAvailableError, and replace hardcoded healthScore with existing circuit-breaker source"
status: pending
priority: P1
effort: 4h
branch: main
tags: [omniroute, routing, review-gaps, testing]
created: 2026-08-10
---

# Close OmniRoute Routing Review Gaps

## Overview
Address three critical gaps identified in the OmniRoute routing implementation review:
1. **Missing direct strategy unit tests** — Strategies are only tested via Inngest integration test mocks
2. **No bilingual progress emission on `NoProvidersAvailableError`** — Error path skips progress events, breaking SSE UX
3. **Hardcoded `healthScore: 1` in provider pool** — Should use existing circuit-breaker health source if available

## Gap Analysis

| Gap | Location | Severity | Impact |
|-----|----------|----------|--------|
| Direct strategy tests | `src/forest/quota/__tests__/` (missing) | High | No coverage for pure strategy logic |
| Bilingual fallback emission | `src/forest/inngest/functions/video-generate.ts:199-210, 286-295` | Medium | SSE subscribers see no progress when no provider |
| Hardcoded healthScore | `src/forest/quota/provider-pool.ts:80` | Medium | No provider health awareness; circuit-breaker exists at `src/seed/utils/circuit-breaker.ts` |

## Phase Summary

| Phase | Description | Files | Effort |
|-------|-------------|-------|--------|
| 01 | Add direct strategy unit tests | `src/forest/quota/__tests__/routing-strategy.test.ts` | 1.5h |
| 02 | Emit bilingual progress on NoProvidersAvailableError | `src/forest/inngest/functions/video-generate.ts` | 1h |
| 03 | Replace hardcoded healthScore with circuit-breaker source | `src/forest/quota/provider-pool.ts`, `src/seed/utils/circuit-breaker.ts` | 1.5h |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/seed/config/routing-strategies.ts` | Strategy types, interfaces, registry |
| `src/forest/quota/routing-strategy.ts` | Strategy implementations + registry |
| `src/forest/quota/provider-pool.ts` | Builds provider pool with healthScore |
| `src/forest/inngest/functions/video-generate.ts` | Inngest function using routing |
| `src/seed/utils/circuit-breaker.ts` | HeyGen KV-backed circuit breaker |
| `src/forest/quota/__tests__/routing-strategy.test.ts` | **NEW** - Direct strategy tests |
| `docs/testing.md` | Testing conventions |