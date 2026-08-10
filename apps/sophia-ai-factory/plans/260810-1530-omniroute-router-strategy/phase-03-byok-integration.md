# Phase 03: BYOK Integration

## Context Links
- **Project**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory
- **Plan**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/plans/260810-1530-omniroute-router-strategy/plan.md
- **Phase 02**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/plans/260810-1530-omniroute-router-strategy/phase-02-strategy-implementations.md
- **BYOK Store**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/tree/byok/user-api-key-store.ts

## Overview
Connect RouterStrategy implementations to Sophia's BYOK (Bring Your Own Keys) system. Strategies must only consider providers for which the user has configured valid API keys. This phase creates the provider pool builder that resolves user keys and checks availability.

**Priority**: HIGH — Required for Phase 04 (Inngest integration)
**Status**: Pending
**Estimated Effort**: 2-3 hours

## Key Insights
1. **BYOK Provider Types** (from user-api-key-store.ts):
   ```typescript
   export type ByokProvider = 'openrouter' | 'anthropic' | 'elevenlabs' | 'd-id' | 'heygen' | 'replicate' | 'muapi' | 'apollo' | 'hunter'
   ```
   Our video providers: `openrouter` (LLM/scripting), `elevenlabs` (TTS), `d-id` (visual), `heygen` (visual/video)

2. **Key Resolution Flow**:
   - `getUserApiKey(userId, provider)` → returns plaintext key or null
   - Keys encrypted at rest, decrypted on read
   - Fallback to env vars if user key not set (platform keys)

3. **Provider Availability** = User has key (BYOK or platform fallback) AND quota allows

4. **Tree Layer Boundary**: BYOK is in `tree/byok`, strategies in `forest/quota` — allowed import (forest → tree)

## Requirements
- Strategies filter pool to user's available providers only
- Use existing `getUserApiKey` from `@/tree/byok/user-api-key-store`
- Platform fallback keys via env vars (OPENROUTER_API_KEY, ELEVENLABS_API_KEY, etc.)
- No new DB queries — leverage existing BYOK store
- Zero `:any` types
- Zod validation on provider pool input

## Architecture
```
src/forest/quota/routing-strategy.ts (modified)
  ├── buildProviderPool(userId, context) → ProviderCandidate[]
  │   ├── getUserApiKey for each video provider
  │   ├── check platform fallback env vars
  │   ├── check quota/health for each
  │   └── return filtered candidates
  └── getProviderCost(provider, taskType) → number
```

**Layer**: forest/quota
**Imports**: `@/tree/byok/user-api-key-store`, `@/seed/config/tiers`, `@/seed/db/client`, `@/forest/quota/video-quota`

## Related Code Files

### Files to Modify
1. `/src/forest/quota/routing-strategy.ts` — Add buildProviderPool, getProviderCost

### Files to Read (Dependencies)
1. `/src/tree/byok/user-api-key-store.ts` — getUserApiKey, ByokProvider type
2. `/src/tree/byok/key-format-validators.ts` — key validation
3. `/src/seed/config/tiers/tier-configs.ts` — TIER_CONFIGS for costs
3. `/src/forest/quota/video-quota.ts` — getVideoUsage, checkVideoQuota
4. `/src/forest/quota/quota-checker.ts` — checkQuotaWithOverage

## Implementation Steps

### Step 1: Define ProviderCandidate Type
In `routing-strategies.ts` (seed layer):
```typescript
export interface ProviderCandidate {
  provider: VideoProvider;
  model: string;           // specific model (e.g., 'elevenlabs-multilingual-v2')
  hasUserKey: boolean;     // true if user provided own key
  costPerUnit: number;     // USD per unit (char, second, token)
  healthScore: number;     // 0-1 (from quota/health checks)
  quotaRemaining: number;  // remaining quota for user
  estimatedCost: number;   // estimated cost for this task
}
```

### Step 2: Implement buildProviderPool
In `routing-strategy.ts` (forest layer):
```typescript
async function buildProviderPool(
  userId: string,
  context: RoutingContext
): Promise<ProviderCandidate[]> {
  const videoProviders: VideoProvider[] = ['openrouter', 'elevenlabs', 'd-id', 'heygen'];
  const candidates: ProviderCandidate[] = [];

  for (const provider of videoProviders) {
    // Check user BYOK key
    const userKey = await getUserApiKey(userId, provider);
    const hasUserKey = !!userKey;

    // Check platform fallback
    const platformKey = getPlatformFallbackKey(provider);
    const hasKey = hasUserKey || !!platformKey;

    if (!hasKey) continue; // Skip unavailable providers

    // Check quota/health
    const quotaResult = await checkQuotaForProvider(userId, provider, context.taskType);
    if (!quotaResult.allowed) continue;

    // Build candidate
    candidates.push({
      provider,
      model: getDefaultModel(provider, context.taskType),
      hasUserKey,
      costPerUnit: getProviderCost(provider, context.taskType),
      healthScore: quotaResult.healthScore ?? 1.0,
      quotaRemaining: quotaResult.remaining ?? 0,
      estimatedCost: estimateTaskCost(provider, context.taskType, context.estimatedInputTokens),
    });
  }

  return candidates;
}
```

### Step 3: Implement Helper Functions
1. `getPlatformFallbackKey(provider)` — read from process.env
2. `getDefaultModel(provider, taskType)` — return default model per provider/task
3. `getProviderCost(provider, taskType)` — from TIER_CONFIGS + BYOK pricing
4. `estimateTaskCost(provider, taskType, estimatedInput)` — calculate cost
5. `checkQuotaForProvider(userId, provider, taskType)` — use video-quota.ts

### Step 4: Update Strategy select() Methods
Modify each strategy to use `buildProviderPool`:
```typescript
async select(pool: ProviderCandidate[], context: RoutingContext): Promise<RoutingDecision> {
  // pool is pre-filtered by buildProviderPool
  // strategy logic operates on filtered pool
}
```

### Step 5: Add Zod Schemas
In `routing-strategies.ts`:
```typescript
export const ProviderCandidateSchema = z.object({...});
export const RoutingContextSchema = z.object({...});
export const RoutingDecisionSchema = z.object({...});
```

### Step 6: Type-Check & Lint

## Todo List
- [ ] Add ProviderCandidate type to routing-strategies.ts
- [ ] Add Zod schemas for validation
- [ ] Implement buildProviderPool in routing-strategy.ts
- [ ] Implement getPlatformFallbackKey
- [ ] Implement getDefaultModel
- [ ] Implement getProviderCost
- [ ] Implement estimateTaskCost
- [ ] Implement checkQuotaForProvider
- [ ] Update all three strategies to use filtered pool
- [ ] Run `npm run type-check` — 0 errors
- [ ] Run `npm run lint` — 0 errors

## Success Criteria
- [ ] buildProviderPool returns only providers with valid keys (user or platform)
- [ ] ProviderCandidate includes cost, health, quota data
- [ ] Strategies work with filtered pool (no key = not considered)
- [ ] Platform fallback keys work when user hasn't provided BYOK
- [ ] Type-check passes with 0 errors
- [ ] No `:any` types

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| BYOK store returns error (D1 down) | Low | High | Fail-open: if key check fails, try platform fallback |
| No providers available for user | Medium | High | Return empty pool; caller handles with graceful error |
| Platform keys not configured | Medium | Medium | Document required env vars; validate at startup |
| Cost calculation inaccurate | Medium | Low | Unit test cost estimates; log actual vs estimated |

## Security Considerations
- API keys never logged (only `hasUserKey: boolean`)
- User keys resolved via BYOK store (encrypted at rest)
- Platform keys from env vars (not in code)
- Pool building audited (which providers considered)

## Next Steps
Phase 04: Inngest Integration — wire strategies into video-generate.ts, video-tts.ts, video-visual.ts