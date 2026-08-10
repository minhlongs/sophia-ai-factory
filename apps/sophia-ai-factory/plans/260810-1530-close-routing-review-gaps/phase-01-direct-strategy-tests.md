# Phase 01: Direct Strategy Unit Tests

## Context Links
- **Plan**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/plans/260810-1530-close-routing-review-gaps/plan.md
- **Source**: `src/forest/quota/routing-strategy.ts` (lines 1-143)
- **Types**: `src/seed/config/routing-strategies.ts` (lines 1-108)
- **Testing Docs**: /Users/macbook/sophia-ai-factory/docs/testing.md

## Overview
Add direct unit tests for the three RouterStrategy implementations (PriorityStrategy, CostOptimizedStrategy, LeastUsedStrategy) that currently only receive coverage via Inngest integration test mocks.

**Priority**: HIGH — Required for deploy green
**Effort**: 1.5h

## Key Insights
- Strategies are **pure synchronous functions** — trivial to test without mocks
- Each strategy takes `ProviderCandidate[]` and `RoutingContext`, returns `RoutingDecision`
- Three strategies registered: `priority`, `cost-optimized`, `least-used`
- Current test coverage: only via `video-generate.test.ts` mocking `selectWithStrategy`
- Missing: edge cases (empty pool, tie-breaking, taskType filtering, cost/usage calculations)

## Requirements

### Functional
- Test each strategy with 5+ provider candidates covering all `VideoTaskType` values
- Test empty pool → `NoProvidersAvailableError` thrown
- Test tie-breaking behavior (stable sort preserves `buildProviderPool` order)
- Test cost-optimized selects lowest `estimatedCost`
- Test least-used selects lowest `usageCount`
- Test priority follows `PROVIDER_PRIORITY` array order

### Non-Functional
- Zero external dependencies (pure sync functions)
- Follow existing test conventions in `src/forest/quota/__tests__/`
- Use Vitest with `describe`, `it`, `expect`
- Run in < 100ms total

## Architecture
- **Layer**: forest/quota (imports seed only)
- **Test location**: `src/forest/quota/__tests__/routing-strategy.test.ts`
- **Imports**: `selectWithStrategy`, `NoProvidersAvailableError`, types from `routing-strategy.ts`

## Related Code Files

| File | Action |
|------|--------|
| `src/forest/quota/__tests__/routing-strategy.test.ts` | **CREATE** - New test file |
| `src/forest/quota/routing-strategy.ts` | Reference only (strategies under test) |
| `src/seed/config/routing-strategies.ts` | Reference only (types, constants) |

## Implementation Steps

### 1. Create test file with fixture builders
```typescript
// src/forest/quota/__tests__/routing-strategy.test.ts
import { describe, it, expect } from 'vitest';
import {
  selectWithStrategy,
  NoProvidersAvailableError,
  type ProviderCandidate,
  type RoutingContext,
  type VideoTaskType,
} from '@/forest/quota/routing-strategy';
```

### 2. Build reusable provider candidate factory
```typescript
function makeCandidate(overrides: Partial<ProviderCandidate> = {}): ProviderCandidate {
  return {
    provider: 'openrouter',
    model: 'openai/gpt-4o-mini',
    hasUserKey: true,
    costPerUnit: 0.002,
    healthScore: 1,
    quotaRemaining: 100,
    usageCount: 0,
    estimatedCost: 0.1,
    ...overrides,
  };
}
```

### 3. Test PriorityStrategy
- Default strategy, follows `PROVIDER_PRIORITY = ['openrouter', 'elevenlabs', 'heygen', 'd-id']`
- 5+ candidates in shuffled order → selects first in priority order
- Same priority candidates → stable sort preserves pool order

### 4. Test CostOptimizedStrategy
- Selects lowest `estimatedCost`
- Tie → stable sort preserves pool order

### 5. Test LeastUsedStrategy
- Selects lowest `usageCount`
- Tie → stable sort preserves pool order

### 6. Test error cases
- Empty pool → throws `NoProvidersAvailableError` with taskType in message
- All candidates have `hasUserKey: false` → empty pool → error

### 7. Test per-taskType filtering
- TTS task → only TTS-capable providers (openrouter, elevenlabs)
- Visual task → only visual-capable providers (heygen, d-id)

## Todo List
- [ ] Create `src/forest/quota/__tests__/routing-strategy.test.ts`
- [ ] Add fixture factory for `ProviderCandidate`
- [ ] Test PriorityStrategy (default)
- [ ] Test CostOptimizedStrategy
- [ ] Test LeastUsedStrategy
- [ ] Test empty pool throws NoProvidersAvailableError
- [ ] Test tie-breaking stable sort
- [ ] Test taskType filtering
- [ ] Run `npx vitest run src/forest/quota/__tests__/routing-strategy.test.ts`
- [ ] Run `npm run type-check`
- [ ] Run `npm test` full suite (verify no regressions)

## Success Criteria
- [ ] New test file passes with 12+ test cases
- [ ] Coverage: 100% of `routing-strategy.ts` branches
- [ ] `npm test` passes all 6,570+ existing tests + new tests
- [ ] `npm run type-check` → 0 errors

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Missing edge case | Medium | Low | Add as discovered; strategies are pure |
| Type drift | Low | Medium | Type-check catches immediately |

## Security Considerations
- Tests use fixture data only — no real API keys
- No database, KV, or external calls
- Safe to run in CI/CD