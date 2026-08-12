---
title: "OmniRoute RouterStrategy — Finalize Setup Wizard + Tests"
description: "Add strategy selection UI to Setup Wizard and write comprehensive tests for the OmniRoute routing system"
status: complete
priority: P2
effort: 2h
branch: main
tags: [omniroute, routing, setup-wizard, testing]
created: 2026-08-13
---

# OmniRoute RouterStrategy — Finalize

## Overview
Complete the OmniRoute RouterStrategy implementation by adding the Setup Wizard
strategy selection UI and writing comprehensive tests for provider pool building
and strategy selection.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 01 | Interface & Constants | ✅ Complete (seed/config/routing-strategies.ts) |
| 02 | Strategy Implementations | ✅ Complete (forest/quota/routing-strategy.ts — 23 tests passing) |
| 03 | BYOK Integration | ✅ Complete (forest/quota/provider-pool.ts — key resolution + health) |
| 04 | Inngest Integration | ✅ Complete (forest/inngest/functions/video-generate.ts — strategy selection active) |
| 05 | Setup Wizard Strategy Selection | ✅ Already complete (provider-credentials-step.tsx:182-215) |
| 06 | Provider Pool Tests | ✅ 24 tests passing (provider-pool.test.ts) |

## Key Files

| File | Purpose |
|------|---------|
| `src/seed/config/routing-strategies.ts` | Strategy types, interfaces, constants |
| `src/forest/quota/routing-strategy.ts` | Strategy implementations + registry |
| `src/forest/quota/provider-pool.ts` | Provider pool builder with health resolution |
| `src/forest/inngest/functions/video-generate.ts` | Inngest function using routing |
| `src/tree/components/setup-wizard/` | Setup Wizard UI components |
| `src/forest/quota/__tests__/routing-strategy.test.ts` | Existing strategy tests (23 passing) |
| `src/forest/quota/__tests__/provider-pool.test.ts` | **NEW** — provider pool tests |

## Acceptance Criteria

1. Setup Wizard includes a strategy selection step where users can choose
   their preferred routing strategy (priority / cost-optimized / least-used)
2. Selected strategy is persisted and used by Inngest video generation functions
3. Provider pool building is tested with coverage for:
   - Key resolution (BYOK vs platform fallback)
   - Health score sources (circuit breaker, registry, default)
   - Empty pool handling
4. All 6,694+ existing tests continue to pass
5. Build clean (0 TypeScript errors)

## Architecture Compliance

- seed → importable by all
- tree → imports seed only
- forest → imports seed, tree
- land → imports seed, tree, forest

## Risk Assessment

- **Low risk**: Setup Wizard UI is additive (new step in existing flow)
- **Low risk**: Provider pool tests are read-only (no code changes)
- **Protected flows**: Setup Wizard BYOK flow must not break

## Next Steps

- Phase 05: Implement strategy selection in Setup Wizard
- Phase 06: Write provider pool unit tests
- Code review
- Commit and verify
