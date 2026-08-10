# Phase 02: Strategy Implementations

## Context Links
- **Project**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory
- **Plan**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/plans/260810-1530-omniroute-router-strategy/plan.md
- **Phase 01**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/plans/260810-1530-omniroute-router-strategy/phase-01-interface-and-constants.md
- **OmniRoute Reference**: https://github.com/diegosouzapw/OmniRoute/blob/main/open-sse/services/autoCombo/routerStrategy.ts

## Overview
Implement three concrete RouterStrategy classes in `src/forest/quota/routing-strategy.ts`:
1. **PriorityStrategy** — Provider priority order (default, like OmniRoute's RulesStrategy)
2. **CostOptimizedStrategy** — Lowest cost per unit (like OmniRoute's CostStrategy)
3. **LeastUsedStrategy** — Provider with lowest recent usage (load balancing)

**Priority**: HIGH — Required for Phases 03-05
**Status**: Pending
**Estimated Effort**: 3-4 hours

## Key Insights
1. **OmniRoute's Strategies**:
   - `RulesStrategy`: 6-factor scoring (quota, health, cost, latency, taskFit, stability)
   - `CostStrategy`: Cheapest healthy provider by costPer1MTokens
   - `LatencyStrategy`: Low p95 latency with reliability weighting
   - `SLAStrategy`: Meets latency/error/cost SLOs
   - `LKGPStrategy`: Last known good provider first

2. **Sophia's Simpler Model**:
   - No circuit breaker state yet (track via quota/health)
   - Provider costs: from tier config + BYOK pricing
   - Task types: tts, visual, compose, upload, publish
   - Usage tracking: video_usage_monthly table + quota KV cache

3. **Strategy Registry Pattern** (from OmniRoute):
   ```typescript
   const strategyRegistry = new Map<string, RouterStrategy>();
   export function registerStrategy(name: string, strategy: RouterStrategy): void
   export function getStrategy(name: string): RouterStrategy
   export function selectWithStrategy(pool, context, strategyName): RoutingDecision
   ```

## Requirements
- All strategies implement `RouterStrategy` interface from Phase 01
- Zero `:any` types
- Use existing quota/health data (no new DB tables)
- Provider cost data from `TIER_CONFIGS` and BYOK pricing
- Strategies registered at module load (no dynamic imports for CF Workers)

## Architecture
```
src/forest/quota/routing-strategy.ts
  ├── interface RouterStrategy (Phase 01)
  ├── class PriorityStrategy implements RouterStrategy
  ├── class CostOptimizedStrategy implements RouterStrategy
  ├── class LeastUsedStrategy implements RouterStrategy
  ├── const strategyRegistry: Map<string, RouterStrategy>
  ├── function registerStrategy()
  ├── function getStrategy()
  ├── function listStrategies()
  └── function selectWithStrategy()
```

**Layer**: forest/quota (orchestrator)
**Imports**: `@/seed/config/routing-strategies`, `@/seed/config/tiers`, `@/tree/byok/user-api-key-store`, `@/seed/db/client`

## Related Code Files

### Files to Modify
1. `/src/forest/quota/routing-strategy.ts` — Add three strategy implementations

### Files to Read (Dependencies)
1. `/src/seed/config/tiers/tier-configs.ts` — TIER_CONFIGS for provider costs
2. `/src/tree/byok/user-api-key-store.ts` — getUserApiKey for provider availability
3. `/src/forest/quota/quota-checker.ts` — quota/health data
4. `/src/forest/quota/video-quota.ts` — video usage tracking

## Implementation Steps

### Step 1: Implement PriorityStrategy
1. **Name**: 'priority'
2. **Description**: 'Selects provider by configured priority order (OpenRouter → ElevenLabs → HeyGen → D-ID)'
3. **Logic**:
   - Define priority order per task type:
     - `tts`: ['elevenlabs', 'openrouter']
     - `visual`: ['heygen', 'd-id']
     - `compose`: ['heygen', 'd-id']
     - `upload`: ['heygen', 'd-id']
     - `publish`: ['heygen', 'd-id']
   - Filter pool to providers user has keys for (via BYOK store)
   - Return first available in priority order
   - Reason: 'PriorityStrategy: selected {provider} (priority {n})'

### Step 2: Implement CostOptimizedStrategy
1. **Name**: 'cost-optimized'
2. **Description**: 'Selects cheapest available provider per task'
3. **Logic**:
   - Define cost per unit per provider (from TIER_CONFIGS + BYOK):
     - OpenRouter: $0.002/1K tokens (varies by model)
     - ElevenLabs: $0.0003/char (TTS)
     - HeyGen: $0.02/second (video)
     - D-ID: $0.015/second (video)
   - Filter to providers with user keys
   - Calculate estimated cost for task
   - Return lowest cost provider
   - Reason: 'CostOptimizedStrategy: {provider} at ${cost}/unit'

### Step 3: Implement LeastUsedStrategy
1. **Name**: 'least-used'
2. **Description**: 'Selects provider with lowest recent usage (load balancing)'
3. **Logic**:
   - Query recent usage from `video_usage_monthly` or quota KV cache
   - Filter to providers with user keys
   - Return provider with lowest usage count in current window
   - Reason: 'LeastUsedStrategy: {provider} (usage: {count} this month)'

### Step 4: Register Strategies at Module Load
```typescript
// Auto-register on import
registerStrategy('priority', new PriorityStrategy());
registerStrategy('cost-optimized', new CostOptimizedStrategy());
registerStrategy('least-used', new LeastUsedStrategy());
```

### Step 5: Add Helper Functions
1. `buildProviderPool(context: RoutingContext, userId: string): Promise<ProviderCandidate[]>`
   - Query BYOK store for user's available providers
   - Check quota/health for each
   - Return array of ProviderCandidate with: provider, model, costPerUnit, healthScore, quotaRemaining

2. `getProviderCost(provider: VideoProvider, taskType: VideoTaskType): number`
   - Return cost per unit from config

### Step 6: Type-Check & Lint
Run `npm run type-check` and `npm run lint`

## Todo List
- [ ] Implement PriorityStrategy class
- [ ] Implement CostOptimizedStrategy class
- [ ] Implement LeastUsedStrategy class
- [ ] Add auto-registration at module load
- [ ] Add buildProviderPool helper
- [ ] Add getProviderCost helper
- [ ] Run `npm run type-check` — 0 errors
- [ ] Run `npm run lint` — 0 errors

## Success Criteria
- [ ] All three strategies implement RouterStrategy interface
- [ ] Strategies auto-register on module import
- [ ] `getStrategy('priority')` returns PriorityStrategy instance
- [ ] `selectWithStrategy(pool, context, 'cost-optimized')` returns RoutingDecision
- [ ] `listStrategies()` returns all three with descriptions
- [ ] Type-check passes with 0 errors
- [ ] No `:any` types

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| BYOK store returns null for missing keys | High | Medium | Filter pool to only providers with keys; fallback to priority if empty |
| Cost data outdated | Medium | Low | Costs from TIER_CONFIGS (source of truth); document update process |
| Quota checker not available in edge runtime | Low | High | Use synchronous createServerClient; handle D1 unavailability gracefully |
| Module load side effects (registration) | Low | Medium | Keep registration synchronous; no async at module level |

## Security Considerations
- No API keys in strategy logic (resolved via BYOK store)
- Usage data from user's own quota (no cross-tenant leakage)
- Strategy selection logged for audit (no PII)

## Next Steps
Phase 03: BYOK Integration — connect strategies to user API key resolution