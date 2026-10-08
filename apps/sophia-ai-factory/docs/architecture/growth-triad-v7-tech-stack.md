# Growth Triad v7: System Architecture & Tech Stack

## Architecture Overview
Growth Triad v7 follows the strict 5-layer Clean Architecture of Sophia AI Factory:

```
[Presentation: React UI Cockpits]
          │
[Land: Server Actions & Better Auth Session]
          │
[Forest: Inngest Durable Workflow Jobs]
          │
[Tree: Deterministic Mathematical Engines (Zero-IO)]
          │
[Seed: Zod Schemas, D1 Migration, Event Types]
```

## Layer-by-Layer Specifications

### 1. Seed Layer
- **Zod Schemas & Types:** `src/seed/types/growth-triad-v7-types.ts`
  - `SponsorshipRateCardInputSchema` & `SponsorshipRateCardOutputSchema`
  - `SaliencyReframeInputSchema` & `SaliencyReframeOutputSchema`
  - `ThumbnailGazeInputSchema` & `ThumbnailGazeOutputSchema`
- **Database Schema:** `migrations/0464_growth_triad_v7.sql`
  - `sponsorship_rate_cards`: Stores channel metrics, rate-card tiers (Dedicated, 60s Mid-Roll, 30s Pre-Roll), and brand pitch decks.
  - `reframe_render_jobs`: Stores aspect ratio conversion coordinates, focal bounding boxes, and kinetic caption styling parameters.
  - `thumbnail_gaze_analyses`: Stores visual saliency metrics, gaze fixation power point adherence, and predicted CTR scores.
- **Inngest Event Types:** `src/seed/inngest/event-types.ts`
  - `sponsorship.ratecard.calculated`: Triggered when sponsorship valuation updates.
  - `reframe.aspect.rendered`: Triggered when video crop and kinetic subtitles are computed.
  - `thumbnail.gaze.scored`: Triggered when thumbnail visual saliency and CTR are estimated.
  - Registry extended from 80 to 83 keys.

### 2. Tree Layer (Pure Algorithmic Engines)
- `src/tree/sponsorship/sponsorship-valuation-engine.ts`:
  - `calculateSponsorshipValuation(input: SponsorshipInput): SponsorshipOutput`
  - `generateBrandPitchEmail(metrics: SponsorshipOutput, brandName: string): PitchEmail`
- `src/tree/reframe/saliency-reframer-engine.ts`:
  - `computeSmoothedCropWindows(keyframes: KeyframeFocalPoint[], sourceAspect: AspectRatio, targetAspect: AspectRatio, alpha?: number): CropWindow[]`
  - `generateKineticCaptionTokens(subtitles: SubtitleSegment[]): KineticCaptionToken[]`
- `src/tree/thumbnail/thumbnail-saliency-engine.ts`:
  - `computeVisualSaliencyScore(features: VisualFeatureVector): SaliencyReport`
  - `estimateThumbnailCTR(saliency: SaliencyReport, composition: CompositionMetrics): CTRPrediction`

### 3. Forest Layer (Inngest Orchestration)
- `src/forest/inngest/functions/sponsorship-pitch-job.ts`
- `src/forest/inngest/functions/saliency-reframe-job.ts`
- `src/forest/inngest/functions/thumbnail-heatmap-job.ts`
- Registered in `src/forest/inngest/functions/index.ts` and `src/app/api/inngest/route.ts`.

### 4. Land Layer (Server Actions)
- `src/land/growth/actions/sponsorship-actions.ts`
- `src/land/growth/actions/reframer-actions.ts`
- `src/land/growth/actions/thumbnail-actions.ts`
- Consolidated in `src/land/growth/actions/growth-triad-v7-actions.ts` and exported via `src/land/growth/index.ts`.

### 5. Presentation Layer (UI Cockpits)
- `src/components/growth-triad-v7/sponsorship-cockpit.tsx`
- `src/components/growth-triad-v7/reframer-cockpit.tsx`
- `src/components/growth-triad-v7/thumbnail-cockpit.tsx`
- Exported via `src/components/growth-triad-v7/index.ts`.
