# Phase 06: Tests

## Context Links
- **Project**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory
- **Plan**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/plans/260810-1530-omniroute-router-strategy/plan.md
- **Phase 01**: interface-and-constants.md
- **Phase 02**: strategy-implementations.md
- **Phase 03**: byok-integration.md
- **Phase 04**: inngest-integration.md
- **Phase 05**: setup-wizard-integration.md
- **Testing Docs**: /Users/macbook/sophia-ai-factory/docs/testing.md

## Overview
Comprehensive unit + integration tests for the RouterStrategy pattern. Baseline: 6,570 tests passing. This phase adds tests for the new routing layer while ensuring zero regressions.

**Priority**: HIGH — Required for deploy green
**Status**: Pending
**Estimated Effort**: 3-4 hours

## Key Insights
1. **Test Files to Create** (following existing `*.test.ts` naming):
   - `src/forest/quota/routing-strategy.test.ts` — Interface, registry, selectWithStrategy
   - `src/forest/quota/priority-strategy.test.ts` — PriorityStrategy
   - `src/forest/quota/cost-strategy.test.ts` — CostOptimizedStrategy
   - `src/forest/quota/least-used-strategy.test.ts` — LeastUsedStrategy
   - `src/forest/quota/provider-pool.test.ts` — buildProviderPool
   - `src/tree/components/setup-wizard/steps/strategy-selection-step.test.tsx` — UI component
   - `src/forest/inngest/functions/video-routing.test.ts` — Inngest integration

2. **Test Patterns** (from existing tests):
   - `byok-crypto.test.ts` — crypto/encryption
   - `key-rotation.test.ts` — integration flows
   - `video-generate.test.ts` — Inngest function tests
   - `api-keys-step.test.tsx` — React component tests

3. **Coverage Targets**:
   - RouterStrategy interface: 100% (pure logic)
   - PriorityStrategy: 100%
   - CostOptimizedStrategy: 100%
   - LeastUsedStrategy: 100%
   - buildProviderPool: 90%+ (mock D1/BYOK)
   - Setup Wizard step: 90%+

## Requirements
- All new tests must pass alongside existing 6,570
- No mocking of internal logic (test real behavior)
- Mock only external boundaries (D1, KV, fetch)
- Vitest as test runner
- Zero flaky tests (no timers, no network)

## Architecture
```
src/forest/quota/__tests__/ (existing pattern)
  ├── routing-strategy.test.ts
  ├── priority-strategy.test.ts
  ├── cost-strategy.test.ts
  ├── least-used-strategy.test.ts
  └── provider-pool.test.ts

src/tree/components/setup-wizard/steps/
  └── strategy-selection-step.test.tsx

src/forest/inngest/functions/__tests__/
  └── video-routing.test.ts
```

## Related Code Files

### Files to Create
1. `/src/forest/quota/routing-strategy.test.ts`
2. `/src/forest/quota/priority-strategy.test.ts`
3. `/src/forest/quota/cost-strategy.test.ts`
4. `/src/forest/quota/least-used-strategy.test.ts`
5. `/src/forest/quota/provider-pool.test.ts`
6. `/src/tree/components/setup-wizard/steps/strategy-selection-step.test.tsx`
7. `/src/forest/inngest/functions/__tests__/video-routing.test.ts`

## Implementation Steps

### Step 1: Test RouterStrategy Interface & Registry
```typescript
// routing-strategy.test.ts
describe('RouterStrategy registry', () => {
  test('getStrategy returns default for unknown name', () => {
    const s = getStrategy('unknown');
    expect(s.name).toBe('priority');
  });
  test('registerStrategy overwrites with warning', () => { ... });
  test('listStrategies returns all three', () => {
    const names = listStrategies().map(s => s.name);
    expect(names).toContain('priority');
    expect(names).toContain('cost-optimized');
    expect(names).toContain('least-used');
  });
});
```

### Step 2: Test PriorityStrategy
- Empty pool → error/fallback
- Pool with providers in priority order → selects highest priority
- Pool missing top priority → selects next available
- Pool filtered by task type (tts → elevenlabs first)

### Step 3: Test CostOptimizedStrategy
- Pool with different costs → selects cheapest
- Tie costs → deterministic (provider order)
- Empty pool → error/fallback
- Only one provider → selects it

### Step 4: Test LeastUsedStrategy
- Pool with usage counts → selects lowest
- Equal usage → deterministic
- Empty pool → error/fallback

### Step 5: Test buildProviderPool
- Mock getUserApiKey returns key for 2 of 4 providers
- Verify pool contains only providers with keys
- Mock platform fallback (env vars)
- Verify quota check filters unavailable providers

### Step 6: Test Setup Wizard Step Component
- Renders all three strategy options
- Bilingual labels render
- onChange called with selected strategy
- Default 'priority' selected

### Step 7: Test Inngest Integration
- Mock selectWithStrategy returns specific provider
- Verify provider client called with decision.provider/model
- Verify fallback to default strategy when no preference

### Step 8: Run Full Test Suite
```bash
npm test   # must pass all (6,570 + new)
npm run type-check
npm run lint
```

## Todo List
- [ ] Write routing-strategy.test.ts
- [ ] Write priority-strategy.test.ts
- [ ] Write cost-strategy.test.ts
- [ ] Write least-used-strategy.test.ts
- [ ] Write provider-pool.test.ts
- [ ] Write strategy-selection-step.test.tsx
- [ ] Write video-routing.test.ts
- [ ] Run full test suite (all pass)
- [ ] Run type-check and lint

## Success Criteria
- [ ] All new test files pass
- [ ] Existing 6,570 tests still pass (zero regression)
- [ ] Coverage > 85% on routing layer
- [ ] Type-check passes with 0 errors
- [ ] Lint passes
- [ ] No `:any` types in test code

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tests fail due to mocking issues | Medium | Medium | Follow existing mock patterns (byok-crypto.test.ts) |
| Flaky tests (async) | Low | Medium | Use synchronous createServerClient; avoid real timers |
| Regression in existing tests | Medium | High | Run full suite; fix root cause not symptom |
| Coverage below threshold | Low | Low | Add edge case tests as needed |

## Security Considerations
- Tests never use real API keys (fixtures only)
- Test data isolated (mock D1/KV)
- No production data touched

## Next Steps
Deploy: `npm run deploy:full` (CF-direct) with SHA verification