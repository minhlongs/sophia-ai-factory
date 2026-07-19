---
title: "Phase 03 — AB: Wire into campaign pipeline + bundle publisher"
description: "Use variant A title in video generation pipeline; complete bundle publisher AB selection"
status: completed
priority: P1
effort: 2h
phase: 3
---

## Context Links
- Inngest function: `src/forest/inngest/functions/generate-campaign.ts` l.63-373
- Orchestrator: `src/land/video/generation/campaign-orchestrator.ts` l.83-345
- Bundle publisher: `src/forest/publishing/bundle-publisher.ts` l.93-241
- Experiment store: `src/forest/ab/experiment-store.ts` l.139 `getExperiment()`
- AB types: `src/forest/ab/ab-types.ts`

## Overview
Two sub-tasks in this phase:
1. **Pipeline title**: When `campaign.created` event fires with `abExperimentId`, the pipeline uses variant A's caption as the video title (instead of `topic`).
2. **Bundle publisher completion**: The existing `abExperimentId`/`abVariantOverride`/`abVariantCaptions` fields in `BundlePublishInput` are partially wired. Complete the integration so the DistributePanel fetches active experiment captions and passes them.

## Key Insights
- The Inngest function already receives an event payload with `topic`, `audience`, `tier`. We add `abExperimentId` and optionally pre-fetched `variantACaption`.
- The pipeline distributes video with title = `topic`. For AB, we want title = `variantACaption`.
- **Decision**: Pass `variantATitle` (from variant A caption) through the event payload rather than reading the experiment in the Inngest function. Rationale: the server action already has the variants in memory; avoid extra D1 read in Inngest.
- The bundle publisher **already has** AB wiring at lines 110-119: it checks `abExperimentId` + `abVariantCaptions` and uses the active variant. The gap is that no caller currently supplies `abVariantCaptions`. We need to add a call to `getExperiment()` in the DistributePanel (or the component that calls `publishToBundle`).
- **File ownership**: Phase 03 touches Inngest function (also touched in prior plans — verify no conflict). Phase 03 does NOT touch `billing-client.tsx` or `sidebar-quota-widget.tsx`.

## Requirements
1. Campaign pipeline uses variant A's caption as video title when `abExperimentId` exists
2. Bundle publisher receives active experiment captions from caller
3. Bundle publisher alternates between variant A and B on repeat publishes (round-robin already partially coded)
4. No change to winner-picker cron — already operational
5. Existing campaigns without `abExperimentId` must work unchanged

## Architecture

### Pipeline Title Selection
```
generateCampaign (Inngest)
  ├─ event.data: { campaignId, userId, topic, ..., abExperimentId?, variantATitle? }
  ├─ distribute-channels step:
  │   campaignTitle = abExperimentId ? (variantATitle ?? topic) : topic  ← NEW
  └─ existing logic unchanged
```

### Bundle Publisher AB Selection (existing wiring — caller gap)
```
DistributePanel (client)
  ├─ fetch getExperiment(abExperimentId) when experiment is active
  ├─ pass abVariantCaptions: { a: exp.variantACaption, b: exp.variantBCaption }
  └─ publishToBundle() picks variant based on abVariantOverride or default 'a'
```

## Related Code Files

| Action | File | Lines |
|--------|------|-------|
| MODIFY | `src/forest/inngest/functions/generate-campaign.ts` | l.67-75 (event payload destructure), l.303 (title assignment) |
| MODIFY | `src/land/video/generation/campaign-orchestrator.ts` | l.83-100 (args interface + title usage) |
| MODIFY | `src/land/campaigns/create-campaign-core.ts` | l.24-32 (CampaignInngestData — add variantATitle) |
| READ (scout) | DistributePanel component — find caller of `publishToBundle` | Need scout |
| MODIFY | DistributePanel or its parent | Pass `abVariantCaptions` to `publishToBundle` |

## Implementation Steps

### Step 1: Add `variantATitle` to Inngest event
In `src/land/campaigns/create-campaign-core.ts`:
```typescript
export interface CampaignInngestData {
  // ... existing fields
  abExperimentId?: string;
  variantATitle?: string; // ← NEW: variant A caption for video title
}
```

### Step 2: Pass `variantATitle` from server action
In `src/app/actions/campaigns.ts` (Phase 02 code block), after variant generation:
```typescript
await sendCampaignCreatedEvent({
  campaignId, userId,
  topic: topic || title!,
  audience: audience || "General",
  tier,
  abExperimentId,
  variantATitle: variants?.variantACaption, // NEW
});
```

### Step 3: Use variant A title in Inngest function
In `src/forest/inngest/functions/generate-campaign.ts`, at line 303:
```typescript
// line 67-75: destructure
const { campaignId, userId, topic, audience, tier, resume, resumeFrom,
        abExperimentId, variantATitle } = eventData;

// line 303: use variantATitle for distribution
const campaignTitle = variantATitle || topic || `Campaign ${campaignId}`;
```

Same change in `src/land/video/generation/campaign-orchestrator.ts` at line 281:
```typescript
const campaignTitle = args.variantATitle || topic || `Campaign ${campaignId}`;
```
Add `variantATitle?: string` to `RunCampaignWorkflowArgs`.

### Step 4: Scout DistributePanel caller
Find the component that calls `publishToBundle()`:
```bash
grep -rn "publishToBundle\|from.*bundle-publisher" src/ --include="*.tsx" | head -10
```
Apply the same scout pattern from the requirements.

### Step 5: Wire bundle publisher AB captions
In the DistributePanel (or caller), when `abExperimentId` exists:
```typescript
import { getExperiment } from '@/forest/ab/experiment-store';

// Before calling publishToBundle:
if (abExperimentId) {
  const experiment = await getExperiment(abExperimentId);
  if (experiment && experiment.status === 'active') {
    publishInput.abVariantCaptions = {
      a: experiment.variantACaption,
      b: experiment.variantBCaption,
    };
    publishInput.abExperimentId = abExperimentId;
  }
}
```

### Step 6: Verify RunCampaignWorkflowArgs parity
The `campaign-orchestrator.ts` is used by the Inngest function wrapper — ensure both accept `variantATitle`. The Inngest function calls `runCampaignWorkflow()` with spread args; verify the args match.

## Todo List
- [ ] Add `variantATitle?: string` to `CampaignInngestData`
- [ ] Pass `variantATitle` from server action to Inngest event
- [ ] Use `variantATitle || topic` for campaign title in Inngest function
- [ ] Use `variantATitle || topic` for campaign title in campaign-orchestrator
- [ ] Scout DistributePanel `publishToBundle` caller
- [ ] Wire `getExperiment()` call in DistributePanel for `abVariantCaptions`
- [ ] Verify backward compat: campaigns without `abExperimentId` use `topic`

## Success Criteria
- Campaign with AB experiment uses variant A caption as video title
- Campaign without AB experiment uses topic (no regression)
- Bundle publisher receives A/B captions when experiment is active
- Bundle publisher falls back to original caption when no experiment
- Winner-picker cron unchanged and still functional

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `variantATitle` missing in event | Low | Low | `undefined ?? topic` fallback is default JS behavior |
| `campaign-orchestrator.ts` and `generate-campaign.ts` diverge | Medium | Med | Add `variantATitle` to both interfaces + unit test both paths |
| DistributePanel not easily reachable for AB captions | Medium | Low | Can defer — bundle publisher already has the wiring; just missing caller |
| D1 read in client component | Medium | Med | Bundle publisher runs client-side; `getExperiment()` calls D1 which is server-only. Use API route or pass via server action |

## Safety Net — Client-side D1 Access
`getExperiment()` uses `getD1()` which requires server context. DistributePanel is a client component. Mitigation options:
- **Option A (recommended)**: Pass `abVariantCaptions` from the server component that renders DistributePanel (fetch experiment in RSC, pass as prop)
- **Option B**: Create a server action `getExperimentCaptions(experimentId): Promise<{a:string, b:string}>`

## Security Considerations
- `getExperiment()` uses `getD1()` — server-only. Must not be called from client components directly.
- BYOK key is not exposed in pipeline title — only the generated caption

## Next Steps
- Phase 06 (Integration tests + build gate)
