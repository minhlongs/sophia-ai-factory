# Wave 23 Tri-Cluster Deep Modularization & Autonomous YouTube Video Engine Port Blueprint

## Executive Summary
This blueprint establishes the dual objective for **Wave 23**:
1. **Source Porting & Adaptation (`ak-xia`)**: Adapt and port the autonomous YouTube video generation architecture from `MohamedElaassal/youtubeVideoGenerator` into Sophia AI Factory's Cloudflare Workers edge & Inngest stack without transplanting monolithic PHP/Docker dependencies.
2. **Tri-Cluster Deep Modularization**: Decompose the next 15 highest-density production monoliths (~4,650 LOC total, all between 296L and 321L) across 3 parallel architectural clusters to enforce the strict `< 200 LOC` invariant, preserving backward-compatible root facades (`< 25 LOC`).

---

## Part 1: Feature Extraction & Architectural Porting (`ak-xia`)

### Source Inspection: `MohamedElaassal/youtubeVideoGenerator`
- **Source Stack**: Laravel, Vue.js, n8n, Docker, Redis, gTTS, Pixabay API, Unsplash API, Google Gemini.
- **Workflow Pipeline**:
  1. `Script Generation`: Google Gemini via prompt engineering.
  2. `Stock Media Retrieval`: Pixabay video search (landscape, 1080p) + Unsplash photo search fallback.
  3. `Voiceover`: gTTS / TTS audio synthesis.
  4. `Assembly`: Local FFmpeg merging video stream + audio stream + SRT subtitles.
  5. `Publishing`: YouTube Data API v3 upload.

### Clean Edge Adaptation for Sophia AI Factory
| Aspect | Source (Laravel/n8n/Docker) | Sophia AI Factory Adaptation |
|---|---|---|
| **Orchestration** | n8n self-hosted webhook server | Native **Inngest Serverless Functions** (`forest/inngest/functions/`) |
| **Media Sourcing** | Pixabay + Unsplash API | Dedicated `tree/media/stock-provider.ts` supporting Pixabay & Pexels BYOK |
| **Video Assembly**| Local container FFmpeg (`exec`) | Cloudconvert REST API / R2 Muxer (`land/video/assembly/ffmpeg/`) |
| **Script Generation** | Direct curl to Gemini | OpenRouter / Gemini BYOK circuit-breaker router (`tree/byok/`) |
| **YouTube Publishing** | OAuth token in MySQL | OAuth2 / BYOK YouTube channel tokens (`tree/youtube-strategy/`) |

---

## Part 2: Tri-Cluster 15 Monolith Modularization Targets

### Cluster 1: Content Generation, Media & Frontend Views (5 Targets ~ 1,550 LOC)
1. `src/app/(app)/affiliate/join/page.tsx` (321L) → `src/app/(app)/affiliate/join/view/`
2. `src/app/[locale]/welcome/[token]/welcome-page-client.tsx` (310L) → `src/app/[locale]/welcome/[token]/client/`
3. `src/land/video/assembly/ffmpeg-muxer.ts` (302L) → `src/land/video/assembly/muxer/`
4. `src/land/youtube/content-calendar.ts` (296L) → `src/land/youtube/calendar/`
5. `src/seed/templates/presets.ts` (330L) → `src/seed/templates/preset-registry/`

### Cluster 2: Orchestration, Workers & Streaming Services (5 Targets ~ 1,550 LOC)
6. `src/forest/streaming/campaign-stream-service.ts` (317L) → `src/forest/streaming/campaign/`
7. `src/forest/inngest/functions/revenue-attribution.ts` (316L) → `src/forest/inngest/functions/revenue-ops/`
8. `src/forest/onboarding/onboarding-tracker.ts` (305L) → `src/forest/onboarding/tracker/`
9. `src/forest/inngest/functions/agent-mission-executor.ts` (304L) → `src/forest/inngest/functions/agent-ops/`
10. `src/forest/webhooks/delivery-bus.ts` (303L) → `src/forest/webhooks/bus/`

### Cluster 3: Billing, Sovereignty & Repository Operations (5 Targets ~ 1,550 LOC)
11. `src/land/billing/overage-topup.ts` (319L) → `src/land/billing/topup/`
12. `src/seed/db/repositories/outcome-tracking-repo.ts` (319L) → `src/seed/db/repositories/outcome/`
13. `src/tree/agency/onboarding-validator.ts` (305L) → `src/tree/agency/validator/`
14. `src/tree/learning-loop/pattern-extractor.ts` (304L) → `src/tree/learning-loop/patterns/`
15. `src/land/billing/nowpayments-ipn-one-time.ts` (304L) → `src/land/billing/ipn/`

---

## Quality Gate Invariants
- Strictly `< 200 LOC` per newly generated submodule.
- Root facades preserved bit-for-bit (`< 25 LOC`).
- Zero `:any` types. Zero `console.log`.
- `npm run type-check` (0 errors).
- `npm run lint -- --quiet` (0 errors).
- `bash scripts/check-layer-boundaries.sh` (0 violations).
- `npm run i18n:validate` (0 missing keys).
- `npm test` (100% green tests).
