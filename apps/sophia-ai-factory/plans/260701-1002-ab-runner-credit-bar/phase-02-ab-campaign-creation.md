---
title: "Phase 02 — AB: Wire variant generation into campaign creation"
description: "Call generateVariants + createExperiment during campaign creation server action"
status: pending
priority: P1
effort: 2h
phase: 2
---

## Context Links
- Server action: `src/app/actions/campaigns.ts` l.13 `createCampaign()`
- Shared core: `src/land/campaigns/create-campaign-core.ts` l.38 `sendCampaignCreatedEvent()`
- Variant gen: `src/forest/ab/variant-generator.ts` l.66 `generateVariants()`
- Experiment store: `src/forest/ab/experiment-store.ts` l.55 `createExperiment()`
- Types: `src/forest/ab/ab-types.ts` l.14 `AbExperiment`, l.35 `CreateExperimentInput`
- BYOK key lookup: `src/tree/byok/` (need to verify exact path for fetching keys)
- Tier limits: `src/seed/config/tiers/unified-limits.ts` l.64 `campaignsPerMonth`

## Overview
When a user creates a campaign via `createCampaign` server action, after successful DB insert and before Inngest send:
1. Fetch user's BYOK OpenRouter key (if available)
2. Call `generateVariants()` with campaign title as `originalCaption`
3. Call `createExperiment()` to persist an `ab_experiments` row
4. Pass experiment ID through the Inngest event payload

## Key Insights
- `generateVariants()` **already has a deterministic fallback** when no BYOK key — always safe to call
- `createExperiment()` needs `videoId` — use `campaignId` as `videoId` (campaign is the video)
- The server action already validates tier + quota via `UNIFIED_TIERS[tier].campaignsPerMonth`
- AB creation is a **fire-and-forget best-effort** operation: if it fails, the campaign still proceeds with its original title. The try/catch in `createCampaign` already wraps the Inngest send; we add variant generation inside that same safety net.
- The `CreateExperimentInput` requires `tenantId` — use `userId` (or resolved org ID)
- **File ownership**: Phase 02 touches `app/actions/campaigns.ts`, Phase 04 touches `billing-client.tsx` — no conflict

## Requirements
1. After successful campaign DB insert, generate A/B variants
2. Persist experiment to `ab_experiments` table
3. Pass `abExperimentId` through Inngest event payload
4. Campaign creation must NOT fail if variant generation fails
5. No duplicate experiments (idempotency: check if experiment already exists for this campaignId)

## Architecture

### Data Flow
```
createCampaign() [app/actions/campaigns.ts]
  1. Insert campaign row (existing)
  2. Generate variants via generateVariants()  ← NEW
  3. Create experiment via createExperiment()   ← NEW
  4. Send Inngest event with abExperimentId     ← MODIFIED
  5. Return success to client
```

### Error Boundary
```
try {
  const variants = await generateVariants({ originalCaption: title, byokOpenRouterKey, locale })
  const abExperimentId = await createExperiment({ ... })
  await sendCampaignCreatedEvent({ ..., abExperimentId })
} catch {
  // Fallback: send event without abExperimentId
  await sendCampaignCreatedEvent({ ... })
}
```

## Related Code Files

| Action | File | Lines |
|--------|------|-------|
| MODIFY | `src/app/actions/campaigns.ts` | l.99-153 (insert + Inngest send block) |
| MODIFY | `src/land/campaigns/create-campaign-core.ts` | l.24-32 `CampaignInngestData` interface |
| READ | `src/tree/byok/` — find `getByokKeys()` or equivalent | Need scout |

## Implementation Steps

### Step 1: Scout BYOK key retrieval
Find how to get user's OpenRouter key in server action context:
```bash
grep -rn "openRouterKey\|byokOpenRouterKey\|getByokKey" src/tree/byok/ | head -10
```
Expected: a function like `getApiKey(userId, 'openrouter')` or `fetchByokKeys(userId)`

### Step 2: Add `abExperimentId` to Inngest event type
In `src/land/campaigns/create-campaign-core.ts`:
```typescript
export interface CampaignInngestData {
  campaignId: string;
  userId: string;
  topic: string;
  audience: string;
  tier: Tier;
  resume?: boolean;
  resumeFrom?: "script" | "tts" | "video" | "finalize";
  abExperimentId?: string;  // ← NEW
}
```

### Step 3: Wire variant generation in `createCampaign()`
In `src/app/actions/campaigns.ts`, after line ~139 (affiliate offer insert) and before line ~143 (sendCampaignCreatedEvent):

```typescript
// A/B variant generation (best-effort — failure does not block campaign)
let abExperimentId: string | undefined;
try {
  const { generateVariants } = await import('@/forest/ab/variant-generator');
  const { createExperiment } = await import('@/forest/ab/experiment-store');
  const byokKey = await getByokOpenRouterKey(userId); // Step 1
  const variants = await generateVariants({
    originalCaption: title!,
    locale: 'en', // or detect from user prefs
    byokOpenRouterKey: byokKey,
  });
  abExperimentId = await createExperiment({
    videoId: campaignId,
    tenantId: userId,
    variantACaption: variants.variantACaption,
    variantBCaption: variants.variantBCaption,
    offerId: offerId ?? undefined,
  });
} catch (err) {
  logger.warn('[createCampaign] AB variant generation failed, continuing without', {
    campaignId, error: toError(err).message
  });
}
```

### Step 4: Pass `abExperimentId` through Inngest
Modify the `sendCampaignCreatedEvent` call to include `abExperimentId`:
```typescript
await sendCampaignCreatedEvent({
  campaignId, userId,
  topic: topic || title!,
  audience: audience || "General",
  tier,
  abExperimentId,  // ← NEW
});
```

## Todo List
- [ ] Scout BYOK key retrieval function path
- [ ] Add `abExperimentId?: string` to `CampaignInngestData` interface
- [ ] Wire `generateVariants()` + `createExperiment()` call in `createCampaign()`
- [ ] Wrap AB generation in try/catch (fire-and-forget)
- [ ] Pass `abExperimentId` in Inngest event
- [ ] Verify campaign still creates successfully when BYOK key is missing

## Success Criteria
- Creating a campaign inserts a row into `ab_experiments` table (verify via wrangler d1)
- Creating a campaign with no BYOK key still succeeds (fallback variants used)
- No regression on existing campaign creation flow

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| BYOK key fetch fails | Medium | Low | Wrapped in try/catch — campaign proceeds without AB |
| D1 insert fails (experiment) | Low | Low | Wrapped in try/catch — campaign proceeds without AB |
| `generateVariants` LLM call slow | Low | Med | Uses `openai/gpt-4o-mini` — fast model; fallback if fails |
| Duplicate experiment for same campaignId | Low | Low | Add uniqueness check before insert |

## Security Considerations
- BYOK key is passed from server action context — no client exposure
- `tenantId` uses `userId` — validates against org membership already

## Next Steps
- Phase 03 (AB: pipeline integration — use variant A title in Inngest function)
