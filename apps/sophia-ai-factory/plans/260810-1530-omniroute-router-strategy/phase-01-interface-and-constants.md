# Phase 01: RouterStrategy Interface & Shared Constants

## Context Links
- **Project**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory
- **Reports**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/plans/reports/
- **Plan**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/plans/260810-1530-omniroute-router-strategy/plan.md
- **OmniRoute Reference**: https://github.com/diegosouzapw/OmniRoute/blob/main/open-sse/services/autoCombo/routerStrategy.ts

## Overview
Create the foundational RouterStrategy interface in `src/forest/quota/routing-strategy.ts` and shared constants in `src/seed/config/routing-strategies.ts`. These are the core types that all strategy implementations and consumers will depend on.

**Priority**: HIGH — Blocks Phases 02-05
**Status**: Pending
**Estimated Effort**: 2-3 hours

## Key Insights
1. **OmniRoute Interface** defines:
   - `RoutingContext`: taskType, requestHasTools, requestHasVision, estimatedInputTokens, lastKnownGoodProvider, lkgpEnabled, sla
   - `RoutingDecision`: provider, model, strategy, reason, candidatesConsidered, finalScore, connectionId
   - `RouterStrategy` interface: `name`, `description`, `select(pool, context) -> RoutingDecision`

2. **Sophia Adaptation**: Our context is video generation (not LLM chat), so:
   - `taskType` → `VideoTaskType` ('tts' | 'visual' | 'compose' | 'upload' | 'publish')
   - Providers: OpenRouter (LLM), ElevenLabs (TTS), D-ID/HeyGen (visual/video)
   - No circuit breaker state in current Sophia — track via quota/health instead

3. **Layer Placement**:
   - Interface in `forest/quota` (orchestrator layer) — used by Inngest functions
   - Constants in `seed/config` (foundational) — imported by all layers

## Requirements
- Zero `:any` types
- Zod validation on all inputs
- Follow canonical imports (`@/seed/...`, `@/tree/...`, `@/forest/...`, `@/land/...`)
- Export public API via barrel (`index.ts`)
- Type-safe strategy registry with discriminated union

## Architecture
```
src/seed/config/routing-strategies.ts    (constants, types, registry - SEED layer)
src/forest/quota/routing-strategy.ts      (interface, registry - FOREST layer)
```

**Import Direction**: `seed` → `forest` (allowed)

## Related Code Files

### Files to Create
1. `/src/seed/config/routing-strategies.ts` — Strategy types, constants, registry
2. `/src/forest/quota/routing-strategy.ts` — RouterStrategy interface, strategy registry

### Files to Modify
1. `/src/seed/config/index.ts` — Re-export routing strategies
2. `/src/forest/quota/index.ts` — Re-export routing strategy interface

## Implementation Steps

### Step 1: Create `src/seed/config/routing-strategies.ts`
1. Define `VideoTaskType` enum: 'tts' | 'visual' | 'compose' | 'upload' | 'publish'
2. Define `VideoProvider` enum: 'openrouter' | 'elevenlabs' | 'd-id' | 'heygen'
3. Define `RoutingContext` interface (adapted from OmniRoute)
4. Define `RoutingDecision` interface (adapted from OmniRoute)
5. Define `RouterStrategy` interface (from OmniRoute)
6. Create strategy registry map with type-safe registration
7. Export constants: `DEFAULT_STRATEGY = 'priority'`, `STRATEGY_NAMES = ['priority', 'cost-optimized', 'least-used']`

### Step 2: Create `src/forest/quota/routing-strategy.ts`
1. Re-export types from `@/seed/config/routing-strategies`
2. Implement `getStrategy(name)` function with fallback to default
3. Implement `registerStrategy(name, strategy)` function
4. Implement `listStrategies()` function
5. Implement `selectWithStrategy(pool, context, strategyName)` function

### Step 3: Update Barrel Exports
1. Add exports to `src/seed/config/index.ts`
2. Add exports to `src/forest/quota/index.ts`

### Step 4: Type-Check Validation
Run `npm run type-check` to verify zero errors

## Todo List
- [ ] Create `src/seed/config/routing-strategies.ts` with all types
- [ ] Create `src/forest/quota/routing-strategy.ts` with interface and registry
- [ ] Update `src/seed/config/index.ts` barrel export
- [ ] Update `src/forest/quota/index.ts` barrel export
- [ ] Run `npm run type-check` — must pass with 0 errors
- [ ] Run `npm run lint` — must pass

## Success Criteria
- [ ] `npm run type-check` exits 0
- [ ] `npm run lint` exits 0
- [ ] Types are importable: `import { RouterStrategy, RoutingContext } from '@/forest/quota/routing-strategy'`
- [ ] Types are importable: `import { VideoTaskType, VideoProvider } from '@/seed/config/routing-strategies'`
- [ ] No `:any` types in new files
- [ ] Strategy registry functions work correctly

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Type conflicts with existing quota types | Medium | High | Use distinct names (VideoTaskType vs existing), check quota-checker-types.ts |
| Circular import seed ↔ forest | Low | High | Ensure forest only imports from seed, not vice versa |
| Missing Zod schemas for validation | Medium | Medium | Add Zod schemas in routing-strategies.ts for context/decision |

## Security Considerations
- No secrets in strategy types
- Provider keys resolved via BYOK store (tree/byok), not in strategy layer
- Strategy selection logged for audit trail

## Next Steps
Phase 02: Implement PriorityStrategy, CostOptimizedStrategy, LeastUsedStrategy in `src/forest/quota/routing-strategy.ts`