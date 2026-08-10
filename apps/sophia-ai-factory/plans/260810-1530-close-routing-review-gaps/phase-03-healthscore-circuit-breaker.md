# Phase 03: Replace Hardcoded healthScore with Circuit-Breaker Source

## Context Links
- **Plan**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/plans/260810-1530-close-routing-review-gaps/plan.md
- **Source**: `src/forest/quota/provider-pool.ts` (line 80: `healthScore: 1`)
- **Circuit Breaker**: `src/seed/utils/circuit-breaker.ts` (HeyGen-specific, KV-backed)
- **Types**: `src/seed/config/routing-strategies.ts` (ProviderCandidate.healthScore)

## Overview
Replace the hardcoded `healthScore: 1` in `buildProviderPool` with a call to the existing HeyGen circuit-breaker (if HeyGen is in the pool). The circuit-breaker at `src/seed/utils/circuit-breaker.ts` provides real health state (`closed`/`open`/`half-open`) based on failure rates. Only HeyGen has a circuit-breaker currently — other providers (OpenRouter, ElevenLabs, D-ID) have no health API.

**Priority**: MEDIUM — Improves routing quality without inventing new infrastructure
**Effort**: 1.5h

## Key Insights
- Comment at line 79: `// No health API exists yet; an available key means the provider is assumed healthy.`
- HeyGen circuit-breaker exists and is production-used (fulfillment webhook records attempts)
- Circuit-breaker state: `closed` (healthy) → `healthScore: 1`, `open` (unhealthy) → `healthScore: 0`, `half-open` → `healthScore: 0.5`
- Other providers: no health source → keep `healthScore: 1` (assumed healthy if key exists)
- Must NOT invent new health infrastructure — only use what exists
- Circuit-breaker is in `seed/utils` (foundational layer) — importable by `forest/quota`

## Requirements

### Functional
- Import `getCircuitStatus` from `@/seed/utils/circuit-breaker`
- For HeyGen provider: call `getCircuitStatus()` → map state to healthScore
  - `closed` → 1.0
  - `half-open` → 0.5
  - `open` → 0.0
- For other providers (openrouter, elevenlabs, d-id): keep `healthScore: 1`
- If circuit-breaker KV unavailable (returns null) → default to 1 (fail-open)
- Strategies already use `healthScore` in sort (see `routing-strategy.ts`)

### Non-Functional
- No new dependencies
- Async call added to `buildProviderPool` (already async)
- Fail-open: if circuit-breaker errors or KV unavailable, assume healthy
- Zero impact if HeyGen not in pool

## Architecture
- **Layer**: forest/quota imports seed/utils (allowed: forest → seed)
- **Files**: 
  - `src/forest/quota/provider-pool.ts` (MODIFY)
  - `src/seed/utils/circuit-breaker.ts` (REFERENCE - exports `getCircuitStatus`)

## Related Code Files

| File | Action |
|------|--------|
| `src/forest/quota/provider-pool.ts` | **MODIFY** - Add circuit-breaker health for HeyGen |
| `src/seed/utils/circuit-breaker.ts` | **REFERENCE** - Exports `getCircuitStatus()` |

## Implementation Steps

### 1. Examine circuit-breaker API (already done)
```typescript
// src/seed/utils/circuit-breaker.ts exports:
export async function getCircuitStatus(): Promise<CircuitStatus>;
// CircuitStatus = { state: 'closed' | 'open' | 'half-open', ... }
```

### 2. Modify `buildProviderPool` in `provider-pool.ts`
```typescript
import { getCircuitStatus } from '@/seed/utils/circuit-breaker';

// Inside the provider loop:
let healthScore = 1;
if (provider === 'heygen') {
  const status = await getCircuitStatus();
  if (status) {
    healthScore = status.state === 'closed' ? 1 : status.state === 'half-open' ? 0.5 : 0;
  }
  // If status is null (KV unavailable), default to 1 (fail-open)
}
```

### 3. Update ProviderCandidate with dynamic healthScore
```typescript
candidates.push({
  provider,
  model: PROVIDER_DEFAULT_MODEL[provider],
  hasUserKey: userKey !== null,
  costPerUnit: getProviderCost(provider, context.taskType),
  healthScore,  // Use dynamic value
  quotaRemaining: Math.max(0, quota.limit - quota.used),
  usageCount: quota.used,
  estimatedCost: estimateTaskCost(provider, context.taskType, context.estimatedInputTokens),
});
```

### 4. Verify strategies consume healthScore
- Check `routing-strategy.ts`: healthScore used as tie-breaker in sorts
- No changes needed there — just providing real values now

### 5. Test
- `npx vitest run src/forest/quota/__tests__/` (if provider-pool tests exist)
- `npx vitest run src/forest/inngest/functions/video-generate.test.ts`
- `npm run type-check`
- `npm test`

## Todo List
- [ ] Add `getCircuitStatus` import to `provider-pool.ts`
- [ ] Add HeyGen healthScore logic in provider loop
- [ ] Keep other providers at healthScore: 1
- [ ] Fail-open default if circuit-breaker returns null
- [ ] Run `npx vitest run src/forest/inngest/functions/video-generate.test.ts`
- [ ] Run `npm run type-check`
- [ ] Run `npm test` full suite

## Success Criteria
- [ ] HeyGen provider gets healthScore from circuit-breaker (0, 0.5, or 1)
- [ ] Other providers unchanged (healthScore: 1)
- [ ] Strategies automatically prefer healthy providers via existing sorts
- [ ] `npm test` passes all tests
- [ ] `npm run type-check` → 0 errors

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Circuit-breaker KV unavailable | Low | Low | Fail-open (default 1) — no routing degradation |
| getCircuitStatus throws | Low | Low | Wrap in try-catch, default to 1 |
| Performance (async call per pool build) | Low | Low | Single KV read; pool built once per video job |

## Security Considerations
- No new attack surface — reads existing KV
- Circuit-breaker already exposed to admin via reset endpoint
- No credentials or secrets involved

## Finding: Document Not Change
If no other provider has a health source (OpenRouter, ElevenLabs, D-ID have no circuit-breaker), **document this gap** rather than invent infrastructure. The no-tech doctrine forbids operator-managed health monitoring. Future: customer could configure health webhook in Setup Wizard (BYOK).

**Decision**: Only HeyGen gets real healthScore. Others stay at 1. Document in code comment.