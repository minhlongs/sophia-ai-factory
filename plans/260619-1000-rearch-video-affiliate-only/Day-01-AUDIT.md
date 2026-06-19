# Day 1 — Audit & Baseline Report
**Date:** 2026-06-19  
**Goal:** Re-architect Sophia AI Factory for Video Marketing (Affiliate Only) — increase feature velocity  
**Scope:** Video domain only, 7-day solo refactor

---

## Executive Summary

| Metric | Current | Target (Post-Refactor) |
|--------|---------|------------------------|
| **God files (>400 lines)** | 6 | 0 |
| **Video files in land/** | 63 scattered | ~40 organized in subdomains |
| **Layer violations** | 0 (script) / 118 F→L, 23 L→F (grep) | <20 total |
| **supabase-types.ts size** | 900 lines | 0 (migrated to seed/types/) |
| **publish-execute.ts** | 620 lines (monolith) | Split into publishing service |
| **video-service.ts** | 452 lines (God Service) | Facade with subdomain services |
| **Feature velocity bottleneck** | High (god files, scattered code) | Low (clear boundaries) |

**Key finding:** The `analyze-layer-violations.ts` script reports 0 violations, but manual grep reveals 118 `forest→land` imports (allowed for orchestration) and 23 forbidden `land→forest` imports. The script likely only checks immediate imports; we'll use grep results for tracking.

---

## Architecture Analysis

### Current Layer Structure

```
seed/      — primitives (147 files)
tree/      — domain logic (162 files) 
forest/    — infrastructure (362 files)
land/      — business workflows (113 files)
```

**Import rules:**
- ✅ `forest` → `land` allowed (orchestration)
- ❌ `land` → `forest` forbidden (23 violations found)
- ❌ `tree` → `forest` forbidden (42 violations)
- ❌ `land` → `tree` forbidden (55 violations)

---

## God Files Identified (Refactor Priority)

### 1. `src/tree/database/supabase-types.ts` — 900 lines
**Problem:** Centralized type dump for ALL tables. Any DB change touches this monolithic file.
**Impact:** High coupling, merge conflicts, difficult navigation.
**Recommendation:** Split into per-domain type modules under `seed/types/`.

### 2. `src/forest/inngest/functions/publish-execute.ts` — 620 lines
**Problem:** Single Inngest function handles all 14 publishers, retry logic, SSRF guards, error sanitization.
**Impact:** Hard to modify per-publisher behavior, tests complex.
**Recommendation:** Extract publisher-specific logic to `land/video/publishing/` services; keep Inngest as thin orchestrator.

### 3. `src/land/video/video-service.ts` — 452 lines
**Problem:** God service consolidating generation, status, retry, publish.
**Impact:** Adding new AI provider requires editing this file; mixed responsibilities.
**Recommendation:** Split into subdomain services with `index.ts` façade.

### 4. `src/seed/config/sops/sop-definitions.ts` — 666 lines
**Problem:** SOP definitions for all verticals in one file.
**Impact:** SOP changes require editing giant file.
**Recommendation:** Split into `seed/config/sops/<vertical>-sops.ts`.

### 5. `src/land/fulfillment/circuit-breaker.ts` — 268 lines
**Problem:** Circuit breaker for HeyGen + retry/backoff logic.
**Impact:** Duplicate patterns may exist elsewhere.
**Recommendation:** Move to `seed/utils/circuit-breaker.ts` for reuse.

### 6. `src/forest/inngest/functions/generate-campaign.ts` — 340 lines
**Problem:** Campaign orchestration mixing affiliate discovery + video generation.
**Impact:** Tight coupling between affiliates and video domains.
**Recommendation:** Extract to `land/affiliates/campaign-orchestrator.ts` or `land/video/campaign-orchestrator.ts`.

---

## Video Domain Analysis

### Current Structure

```
land/video/
├── video-service.ts (452 lines) — main entry point
├── video-job-fsm.ts — state machine
├── video-job-pipeline.ts — pipeline definition
├── video-render-provider.ts
├── video-storage-service.ts
├── composer-ffmpeg.ts (294)
├── ffmpeg-muxer.ts (275)
├── kling-client.ts, heygen-helpers.ts, wan21-client.ts
├── assemblyai-client.ts, fish-speech-client.ts, tts-client.ts
├── path-a-template.ts, path-b-cinematic.ts
├── overlay modules (crypto, ftc)
├── utility modules (scene-detector, subtitle-generator, etc.)
└── __tests__/ (18 test files)
```

**Count:** 63 TypeScript files

**Dependencies:**
- `video-service.ts` imports: 4 direct imports (from server actions)
- `video-service.ts` internally imports: `@/forest/quota/video-quota`, `@/forest/missions/emit-video-generate`
- `publish-execute.ts` (forest) imports: `@/land/video/get-canonical-video-url` (orchestration allowed)
- No direct `land→forest` imports in video module (✅)

---

## Affiliate Integration State

**Existing affiliate modules** (already well-organized):

```
land/affiliates/
├── video-description-injector.ts  ← injects affiliate links into video description
├── promo-library.ts               ← manages affiliate offer catalog
├── click-recorder.ts              ← tracks clicks
├── conversion-attributor.ts       ← attributes conversions
├── commission-calculator.ts       ← calculates commissions
├── credentials.ts                 ← API keys storage
├── leaderboard.ts                 ← affiliate leaderboards
├── providers/                     ← ClickBank, ShareASale, etc.
└── discovery/                     ← AI-powered offer discovery
```

**Integration points:**
- `land/video/ftc-disclosure-overlay.ts` — FTC compliance (affiliate disclosure)
- `land/affiliates/video-description-injector.ts` — pure function, no tight coupling
- **Gap:** Video generation flow does NOT automatically select affiliate offers to feature. This is manual/user-driven.

---

## Publisher Landscape

**14 publishers** in `forest/publishing/`:
YouTube, TikTok, Instagram, Facebook, Twitter/X, Pinterest, LinkedIn, Zalo, Threads, Reddit, Bluesky, Mastodon, etc.

All imported by `publish-execute.ts` (620 lines) — **monolithic switch statement** likely.

---

## Current Video Flow (End-to-End)

```
User Action (Server Action)
  ↓
land/video/video-service.ts:generateVideo()
  - Checks operator config (aiPromptPipelineConfigured)
  - Validates input
  - Checks tier (TIER_ALLOWED_VIDEO)
  - Reserves quota (forest/quota/video-quota)
  - Inserts engine_missions row (status=pending)
  - Emits inngest event: video/generate.requested
  ↓
forest/missions/emit-video-generate.ts → Inngest
  ↓
forest/inngest/functions/generate-campaign.ts (340 lines)
  - Orchestrates: script → TTS → visual → assembly
  - Calls provider clients (heygen, kling, wan2.1)
  - Updates engine_missions status
  ↓
HeyGen/Kling API (async)
  ↓
HeyGen Webhook → land/fulfillment/complete-video-from-webhook.ts
  - Downloads video from HeyGen
  - Stores to R2 (land/video/video-storage-service)
  - Sends ready email
  - Updates video row to completed
  ↓
User calls publishVideo()
  ↓
forest/inngest/functions/publish-execute.ts (620 lines)
  - FSM: scheduled → uploading → processing → live
  - Refreshes OAuth tokens (forest/publishing/oauth-token-refresher)
  - Calls platform publishers (YouTubePublisher, TikTokPublisher, etc.)
  - Polls for completion
  - Sends Telegram notification
```

---

## Affiliate-Only Flow Gap Analysis

**Current:** Users can add affiliate links to video descriptions (via `video-description-injector`).

**Missing for "Affiliate Only Video Marketing":**
1. **Offer discovery UI** — browse affiliate offers from integrated networks (ClickBank, ShareASale)
2. **Automatic offer matching** — AI suggests relevant offers based on video niche/content
3. **Link cloaking** — pretty affiliate URLs (e.g., `sophia.agencyos.network/r/abc123`)
4. **Commission tracking dashboard** — real-time earnings per video
5. **A/B testing** — test different affiliate placements in descriptions
6. **Auto-insertion** — automatically append top-performing offers to descriptions (already exists but not AI-driven)

**Note:** These are **land/affiliates/** responsibilities, not video domain changes.

---

## Dependencies Heatmap

### Cross-Layer Import Issues (Forbidden)

| Violation Type | Count | Examples |
|----------------|-------|----------|
| `land→forest` | 23 | `land/fulfillment` imports from `forest/publishing`? |
| `tree→forest` | 42 | `tree/telegram` imports from `forest/publishing`? |
| `land→tree` | 55 | Various land modules importing tree utilities that should be seed |

**Action:** Day 6 will fix these violations by:
- Moving shared utilities to `seed/utils/`
- Inverting dependencies (event-driven communication)
- Creating barrel re-exports for backward compatibility

---

## Recommendations (7-Day Plan)

### **Day 2 — Seed Types Refactor**
Create `seed/types/`:
```
seed/types/
├── video.ts        ← VideoJob, VideoOutput, Provider types
├── affiliate.ts    ← AffiliateLink, Offer, Commission
├── user.ts         ← User, Profile, Tier
├── billing.ts      ← Purchase, Subscription
├── index.ts        ← barrel (backward compat)
```
Migrate from `supabase-types.ts` gradually.

### **Day 3 — Video Domain Split**
```
land/video/
├── generation/
│   ├── providers/    ← heygen, kling, wan2.1 adapters
│   ├── script-generator.ts
│   ├── tts-client.ts
│   └── index.ts
├── assembly/
│   ├── composer-ffmpeg.ts
│   ├── ffmpeg-muxer.ts
│   ├── overlays/     ← crypto, ftc, custom
│   └── index.ts
├── storage/
│   ├── r2-upload.ts
│   ├── signed-url.ts
│   └── video-storage-service.ts (moved)
├── publishing/
│   ├── youtube-publisher.ts (moved from forest)
│   ├── tiktok-publisher.ts
│   ├── index.ts      ← façade for all publishers
├── templates/
│   ├── path-a-template.ts
│   ├── path-b-cinematic.ts
│   └── index.ts
└── index.ts          ← public façade (replaces video-service.ts)
```

### **Day 4 — Inngest Functions Refactor**
- Move `publish-execute.ts` logic to `land/video/publishing/execute.ts`
- Keep thin Inngest wrapper in `forest/inngest/functions/publish-execute.ts`
- Move `generate-campaign.ts` to `land/video/generation/campaign-orchestrator.ts`

### **Day 5 — Forest Missions Reorganization**
```
forest/missions/
├── video/           ← video.generate.*, video.publish.*
├── campaign/        ← campaign.* (if still needed)
├── billing/         ← billing.webhook, subscription.*
├── quota/           ← quota.*
└── index.ts
```

### **Day 6 — Dependency Cleanup**
- Fix all `land→forest` imports (23 violations)
- Fix `tree→forest` (42) and `land→tree` (55)
- Run full test suite, ensure 0 regressions
- Verify layer violations via grep

### **Day 7 — Documentation**
- Update `CLAUDE.md` with new structure
- Write `docs/video-domain-architecture.md`
- Create migration scripts for imports
- Developer onboarding guide

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing video flows | High | Run full test suite after each day; use `verify.sh` |
| Missing import migrations | Medium | Create automated script to update imports |
| Merge conflicts on `supabase-types.ts` | Medium | Keep old file with barrel re-export during transition |
| Inngest event schema changes | High | Preserve event names, only move code location |
| Publisher behavior changes | Medium | Integration tests for each publisher |

---

## Success Metrics

- ✅ All tests pass (`npm test`)
- ✅ No `land→forest` or `tree→forest` imports
- ✅ God files eliminated (<300 lines each)
- ✅ Video generation flow works end-to-end (verified via `verify-user-video-flow.mjs`)
- ✅ Deploy SHA matches production (`deploy:full` → `/api/version`)

---

## Next Steps (Day 2)

Begin `seed/types/` extraction. Target: migrate 50 most-used types from `supabase-types.ts`.

**Files to create:**
1. `seed/types/video.ts` — VideoJob, VideoStatus, Provider types
2. `seed/types/affiliate.ts` — AffiliateLink, Offer, Commission
3. `seed/types/user.ts` — User, Profile, Settings
4. `seed/types/billing.ts` — Purchase, Subscription, Invoice
5. `seed/types/index.ts` — barrel re-export all (backward compatibility)

**Backward compatibility:** Keep `tree/database/supabase-types.ts` as:
```typescript
export * from '@/seed/types/video';
export * from '@/seed/types/affiliate';
// ... etc
```

This allows gradual migration over Days 2-6.

---

**Report generated:** 2026-06-19  
**Status:** Audit complete — ready for Day 2
