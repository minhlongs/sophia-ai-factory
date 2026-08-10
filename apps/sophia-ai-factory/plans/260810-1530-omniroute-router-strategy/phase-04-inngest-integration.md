# Phase 04: Inngest Integration

## Context Links
- **Project**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory
- **Plan**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/plans/260810-1530-omniroute-router-strategy/plan.md
- **Phase 03**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/plans/260810-1530-omniroute-router-strategy/phase-03-byok-integration.md
- **Inngest Functions**: /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/functions/

## Overview
Integrate RouterStrategy into Inngest workflow functions for video generation:
1. `video-generate.ts` — main video generation workflow
2. `video-tts.ts` — text-to-speech step
3. `video-visual.ts` — visual/video generation step
4. `video-compose.ts` — composition step

Each step will use `selectWithStrategy` to choose the optimal provider based on user's configured strategy.

**Priority**: HIGH — Core functionality
**Status**: Pending
**Estimated Effort**: 4-5 hours

## Key Insights
1. **Current Video Generation Flow** (from video-generate.ts):
   - Step 1: scripting (OpenRouter LLM)
   - Step 2: generate-tts (ElevenLabs/Fish Speech)
   - Step 3: generate-video (Wan 2.1 via HeyGen/D-ID)
   - Step 4: poll-video-ready
   - Step 5: download-video
   - Step 6: mux-audio-video (CloudConvert)
   - Step 7: update-mission
   - Step 8: emit-usage

2. **Strategy Selection Points**:
   - **Scripting**: OpenRouter (only LLM provider currently)
   - **TTS**: ElevenLabs vs OpenRouter TTS vs platform fallback
   - **Visual**: HeyGen vs D-ID (primary video providers)
   - **Compose/Upload/Publish**: HeyGen/D-ID

3. **User Strategy Preference**: Stored in user preferences (new field) or tier default
   - Default: 'priority' (Matches current behavior)
   - Configurable via Setup Wizard (Phase 05)

4. **Inngest Step Pattern**: Each step is an `inngest.step` — strategy selection happens at step start

5. **Context for Routing**:
   ```typescript
   const context: RoutingContext = {
     taskType: 'tts' | 'visual' | 'compose' | 'upload' | 'publish',
     estimatedInputTokens: data.prompt?.length,
     requestHasTools: false,
     requestHasVision: taskType === 'visual',
   };
   ```

## Requirements
- Use `selectWithStrategy` from `@/forest/quota/routing-strategy`
- Get user's preferred strategy from user preferences (new DB field) or tier default
- Pass selected provider/model to existing provider clients
- Maintain backward compatibility (default strategy = current behavior)
- Zero `:any` types
- All existing tests must pass

## Architecture
```
src/forest/inngest/functions/video-generate.ts (modified)
  ├── getUserStrategyPreference(userId) → strategyName
  ├── buildRoutingContext(taskType, data) → RoutingContext
  ├── selectWithStrategy(pool, context, strategyName) → RoutingDecision
  └── use decision.provider/decision.model for provider client

src/forest/inngest/functions/video-tts.ts (modified)
  └── Same pattern for TTS step

src/forest/inngest/functions/video-visual.ts (modified)
  └── Same pattern for visual step
```

**Layer**: forest/inngest/functions
**Imports**: `@/forest/quota/routing-strategy`, `@/tree/byok/user-api-key-store`, `@/seed/db/client`

## Related Code Files

### Files to Modify
1. `/src/forest/inngest/functions/video-generate.ts` — Add strategy selection for scripting, TTS, visual
2. `/src/forest/inngest/functions/video-tts.ts` — Add strategy selection for TTS
3. `/src/forest/inngest/functions/video-visual.ts` — Add strategy selection for visual
4. `/src/forest/inngest/functions/video-compose.ts` — Add strategy selection for compose

### Files to Create/Modify
1. `/src/forest/quota/routing-strategy.ts` — Ensure selectWithStrategy is exported and async-compatible

### Files to Read (Dependencies)
1. `/src/forest/inngest/functions/video-generate.ts` — Full workflow
2. `/src/forest/inngest/functions/video-tts.ts` — TTS step
3. `/src/forest/inngest/functions/video-visual.ts` — Visual step
4. `/src/forest/inngest/functions/video-compose.ts` — Compose step

## Implementation Steps

### Step 1: Add User Strategy Preference Storage
**Option A**: Add to user_preferences table (new column)
**Option B**: Add to user_profiles JSON column
**Option C**: Derive from tier (BASIC=priority, PREMIUM=cost-optimized, ENTERPRISE=least-used)

**Decision**: Option B — add `routing_strategy` to user_profiles JSON, default from tier

```sql
-- Migration: add routing_strategy to user_profiles
-- Default: BASIC→priority, PREMIUM→cost-optimized, ENTERPRISE/MASTER→least-used
```

### Step 2: Create getUserStrategyPreference Helper
In `routing-strategy.ts` or new `strategy-prefs.ts`:
```typescript
async function getUserStrategyPreference(userId: string): Promise<string> {
  const db = createServerClient();
  const profile = await db.prepare('SELECT profile_json FROM user_profiles WHERE user_id = ?1')
    .bind(userId).first<{ profile_json: string }>();
  
  if (profile?.profile_json) {
    const parsed = JSON.parse(profile.profile_json);
    if (parsed.routing_strategy) return parsed.routing_strategy;
  }
  
  // Fallback to tier default
  const tier = await getUserTier(userId);
  return getDefaultStrategyForTier(tier);
}

function getDefaultStrategyForTier(tier: Tier): string {
  switch (tier) {
    case 'BASIC': return 'priority';
    case 'PREMIUM': return 'cost-optimized';
    case 'ENTERPRISE':
    case 'MASTER': return 'least-used';
    default: return 'priority';
  }
}
```

### Step 3: Modify video-generate.ts
1. Import `selectWithStrategy`, `buildProviderPool`, `getUserStrategyPreference`
2. At each provider selection point (scripting, TTS, visual):
   ```typescript
   const strategyName = await getUserStrategyPreference(userId);
   const context = buildRoutingContext('visual', { estimatedInputTokens: prompt.length });
   const pool = await buildProviderPool(userId, context);
   const decision = selectWithStrategy(pool, context, strategyName);
   
   // Use decision.provider, decision.model for provider client
   const providerClient = getProviderClient(decision.provider, decision.model);
   ```
3. Pass provider to existing Wan 2.1 / HeyGen / D-ID clients

### Step 4: Modify video-tts.ts
Similar pattern for TTS step — select between ElevenLabs, OpenRouter TTS

### Step 5: Modify video-visual.ts
Select between HeyGen, D-ID for visual generation

### Step 6: Modify video-compose.ts (if applicable)
Select provider for composition/muxing

### Step 7: Update Provider Clients
Ensure provider clients accept dynamic provider/model from decision:
- `getWanClient(model)` → `getVideoClient(provider, model)`
- `getElevenLabsClient()` → `getTTSClient(provider, model)`

### Step 8: Run Tests
```bash
npm test -- --filter=video-generate
npm test -- --filter=video-tts
npm test -- --filter=video-visual
npm run type-check
npm run lint
```

## Todo List
- [ ] Add routing_strategy to user_profiles (migration)
- [ ] Create getUserStrategyPreference helper
- [ ] Create getDefaultStrategyForTier helper
- [ ] Modify video-generate.ts for strategy selection
- [ ] Modify video-tts.ts for strategy selection
- [ ] Modify video-visual.ts for strategy selection
- [ ] Modify video-compose.ts for strategy selection
- [ ] Update provider client factories to accept dynamic provider/model
- [ ] Run video-generate tests
- [ ] Run video-tts tests
- [ ] Run video-visual tests
- [ ] Run full test suite
- [ ] Run type-check and lint

## Success Criteria
- [ ] video-generate.ts uses selectWithStrategy for provider selection
- [ ] User's preferred strategy respected (from profile or tier default)
- [ ] Fallback to 'priority' if no preference set
- [ ] All existing video generation tests pass
- [ ] Type-check passes with 0 errors
- [ ] No `:any` types

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing video generation | High | Critical | Default strategy 'priority' = current behavior; feature flag if needed |
| Provider client API mismatch | Medium | High | Update client factories to accept provider/model params |
| Inngest step timeout with strategy logic | Low | Medium | Strategy selection is fast (<10ms); cache pool if needed |
| Migration fails on existing users | Low | High | Default strategy in code; migration only adds column |

## Security Considerations
- User strategy preference stored in profile (user-controlled via Setup Wizard)
- No API keys in routing logic
- Strategy selection logged for audit

## Next Steps
Phase 05: Setup Wizard Integration — UI for strategy selection