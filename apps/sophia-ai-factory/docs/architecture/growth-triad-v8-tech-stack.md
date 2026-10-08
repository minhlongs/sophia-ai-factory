# System Architecture: Growth Triad v8 Tech Stack

## Overview
Growth Triad v8 extends Sophia AI Factory's viral automation capabilities with Audio Resonance Sync, Community Engagement Catalysts, and Subscriber Cohort LTV modeling.

## Layer-by-Layer Architecture

### 1. Seed Layer (`src/seed/`)
- `src/seed/types/growth-triad-v8-types.ts`: Zod schemas and TypeScript types for Audio Resonance, Community Bait, and Cohort LTV.
- `migrations/0465_growth_triad_v8.sql`: Cloudflare D1 tables:
  - `audio_resonance_jobs`
  - `community_bait_campaigns`
  - `subscriber_cohort_ltv_snapshots`
- `src/seed/inngest/event-types.ts`: Registers 3 new Inngest event keys (bringing total from 83 to 86 keys):
  - `audio.resonance.synced`
  - `community.bait.generated`
  - `subscriber.cohort.evaluated`

### 2. Tree Layer Pure Algorithmic Engines (`src/tree/`)
- `src/tree/audio/audio-resonance-engine.ts`: Beat-drop quantization, audio ducking cue generation, and resonance indexing.
- `src/tree/community/community-bait-engine.ts`: Curiosity gap scoring, comment velocity modeling, and discussion hook generation.
- `src/tree/cohort/subscriber-cohort-ltv-engine.ts`: Weibull hazard decay modeling, cohort retention forecasting, and LTV calculation.

### 3. Forest Layer Inngest Background Jobs (`src/forest/`)
- `src/forest/inngest/functions/audio-resonance-job.ts`: Persists audio resonance calculations and cues.
- `src/forest/inngest/functions/community-bait-job.ts`: Persists viral discussion hooks and sentiment ratings.
- `src/forest/inngest/functions/subscriber-cohort-job.ts`: Persists cohort survival statistics and LTV forecasts.

### 4. Land Layer Server Actions (`src/land/`)
- `src/land/growth/actions/audio-actions.ts`: Authenticated audio beat-drop quantization action.
- `src/land/growth/actions/community-actions.ts`: Authenticated discussion hook generation action.
- `src/land/growth/actions/cohort-actions.ts`: Authenticated subscriber cohort LTV analysis action.
- `src/land/growth/actions/growth-triad-v8-actions.ts`: Barrel export.

### 5. Presentation Layer UI Cockpits (`src/components/growth-triad-v8/`)
- `audio-resonance-cockpit.tsx`: Audio Beat-Drop & Resonance HUD.
- `community-bait-cockpit.tsx`: Discussion Catalyst & Viral Bait HUD.
- `cohort-ltv-cockpit.tsx`: Subscriber Weibull Hazard & LTV HUD.
- `index.ts`: Presentation barrel export.
