# Recon 11 — Factory Cells (Sections 13 & 14)

**Date:** 2026-08-31
**Work context:** /Users/macbook/sophia-ai-factory
**Scope:** Sections 13 & 14 — Sophia as AI Factory + Bottleneck Analysis
**Method:** Read-only audit, all citations point to production source files

---

## SECTION 13 — SOPHIA AS AI FACTORY

### 13.1 CEO Classification

**Verdict: F. Hybrid** (AI video SaaS + AI workflow engine + emerging factory-OS skeleton)

Sophia is NOT yet a genuine "AI Factory operating system" (D) nor a pure "AI video generator" (A). Evidence shows three overlapping layers:

1. **AI video SaaS** — the customer-facing face is a video generation + publishing platform: `land/video/publishing/video-generation.service.ts`, `land/video/generation/video-job-fsm.ts`, `land/video/generation/video-render-provider.ts` (heygen/facefusion/wav2lip). Customers enter BYOK keys, generate videos, publish to YouTube/TikTok.

2. **AI workflow engine** — all long-running jobs route through Inngest with guarded multi-step pipelines: `forest/inngest/functions/video-generate.ts` (9 sequential `step.run` calls: parse-input → resolve-routing-strategy → generate-tts → poll-video-ready → download-video → generate-subtitles → mux-audio-video → update-mission → insert-videos-row → emit-usage). The FSM has 8 states: `land/video/generation/video-job-fsm.ts`.

3. **Emerging factory-OS skeleton** — the `land/factory/` folder exists (`index.ts`, `url-product-extractor.ts`, `url-to-revenue.ts`, 351 LOC total) but is thin. Intelligence, Creative, and Creative-Economy cells exist in land/ but are not yet orchestrated by a unified "factory scheduler". The `campaign-orchestrator.ts` imports `ServiceFactory`, `startVideoGeneration`, `OpenClawGateway`, `SmartResumeEngine`, `YouTubeChannelAdapter` — proof of intent for factory-style orchestration, but no cell-level production scheduler exists.

Pure "video generator" (A) is wrong: there is full billing, affiliate, payout, and publishing logic (`land/billing/`, `land/affiliates/`, `land/payouts/`, `land/video/publishing/`).
Pure "workflow engine" (C) is wrong: customers buy video output, not generic workflows.
"Factory OS" (D) is aspirational — the scheduler and most cells are missing.
"Agentic creative production platform" (E) is closest competitor framing but overstates the agent autonomy (see Section 14 bottlenecks).

**Sophia today = Hybrid: an AI video SaaS built on a workflow-engine substrate with factory-OS ambitions not yet realized.**

---

### 13.2 Factory Cells Assessment

Legend: **IMPLEMENTED** = production code, not mock. **PARTIAL** = core exists but key paths missing. **MISSING** = not present. **EXPERIMENTAL** = local/BYOK-only, not SaaS-default.

| Cell | Status | Evidence |
|------|--------|----------|
| **Intelligence Cell** | PARTIAL | `land/intelligence/` (hunter-client, normalization, runner, scoring, types). `forest/ai/cost-aware-router.ts` routes by cost. `forest/ai/script-generator.ts` generates scripts. But no unified "decide what to make next" agent. Intelligence is script + data plumbing, not strategy. |
| **Creative Cell** | PARTIAL | `land/creative-mission/actions.ts` (26 KB, mission lifecycle). `land/creative-memory/actions.ts` (7 KB). `land/creative-economy/` (11 files: dashboard-summary, investment-advisor, learning-velocity, playbook-health, roi-modeling, snapshot-writer). These are analytics + memory, not generative creative. No "creative director" cell that picks themes, iterates concepts, A/B tests hooks. |
| **Image Cell** | MISSING | `forest/ai/providers/mock-image-generation-provider.ts` exists. `forest/ai/providers/openrouter-image-adapter.ts` exists. `seed/ai/providers/hermes-capabilities.ts` explicitly declares **NO /v1/images endpoint** → image.generate = UNSUPPORTED. Hermes is input-only vision. No production image-generation path. Customer must BYOK to DALL-E/Midjourney via OpenRouter but no native capability. |
| **Video Cell** | IMPLEMENTED | `land/video/generation/video-job-fsm.ts` (8-state FSM), `video-job-pipeline.ts`, `video-render-provider.ts` (heygen/facefusion/wav2lip + mock guard). `forest/video/video-generate.ts` (full 9-step Inngest pipeline). Multiple render clients: `wan21-client.ts` (Replicate), `kling-client.ts` (fal.ai), `tts-client.ts` (ElevenLabs), `fish-speech-client.ts` (fal.ai), `assemblyai-client.ts`. `land/video/templates/visual-router.ts` routes enterprise→cinematic (HunyuanVideo on Runpod), free/pro→template (MoviePy). |
| **Audio Cell** | IMPLEMENTED | `land/video/generation/tts-client.ts` (ElevenLabs via /api/internal/tts), `fish-speech-client.ts` (fal.ai, synchronous-style), `assemblyai-client.ts` (transcription). `land/voice/clone-voice.ts` (ElevenLabs voice cloning BYOK). `forest/ai/text-to-speech-generator-elevenlabs.ts`. Full TTS + transcription + voice clone present. |
| **Render Cell** | PARTIAL | `land/video/assembly/composer-ffmpeg.ts` (MoviePy Fly service, /compose + /compose-rich). `land/video/assembly/ffmpeg-muxer.ts` (Cloudconvert REST API, POLL_INTERVAL_MS=3000, POLL_MAX_ATTEMPTS=40). `video-render-provider.ts` (heygen in production, mock REJECTED unless SOPHIA_CORE_VIDEO_PROOF=1). No native renderer — entirely BYOK + external services. |
| **QA Cell** | PARTIAL | `land/validation/services.ts` (validateOpenRouter, validateElevenLabs, validateDID, validateAirtable, validateHeyGen — all with circuit breaker). `land/video/templates/scene-detector.ts` (FFmpeg scdet config). `land/video/templates/highlight-scorer.ts`. No post-generation QA (no automated video quality scoring, no content-policy gate). |
| **Billing Cell** | IMPLEMENTED | `land/billing/` (30+ files): `nowpayments-ipn-db.ts`, `overage-topup.ts`, `tier-change-provisioner.ts`, `usage-aggregator.ts`, `video-production-cost-engine.ts`, `dynamic-pricing.ts`, `dunning-workflow.ts`, `subscription-expiry.ts`, `refund-badge-cap.ts`, `white-label.ts`, `resend-email-service.ts`. `seed/config/tiers/tier-configs.ts` defines NOWPAYMENTS_INVOICE_IDS per tier. Full metering + tier + refund + dunning present. |
| **Delivery Cell** | IMPLEMENTED | `land/video/publishing/` (15+ platform providers): youtube-publisher, tiktok-publisher, instagram-publisher, facebook-publisher, twitter-publisher, linkedin-publisher, pinterest-publisher, reddit, threads, mastodon, bluesky, zalo-publisher, whatsapp-adapter, `publisher-interface.ts`, `platform-adapter.ts`. `land/fulfillment/` (complete-video-from-webhook, one-time-fulfillment, compensation, retry-backoff, circuit-breaker-comms). `land/affiliates/` (clickbank-postback-parser, commission-ledger, leaderboard, offer-sync). `land/payouts/` (commission-ledger, stripe-connect, nowpayments-mass-payout). |

---

### 13.3 Code-path Grep Results

**Video generation**
- `land/video/generation/video-job-pipeline.ts` — creates video_jobs row, fires `video.requested` Inngest event, checks budget via `checkVideoBudget`
- `land/video/generation/video-job-fsm.ts` — 8-state FSM, STATUS_PROGRESS map, guards prevent illegal transitions
- `land/video/generation/wan21-client.ts`, `kling-client.ts` — Replicate + fal.ai text-to-video
- `forest/video/video-generate.ts` — 9-step Inngest pipeline orchestrating script→TTS→visual→compose→mux→upload

**Audio generation**
- `land/video/generation/tts-client.ts` — ElevenLabs via internal API, circuit breaker on `elevenlabs` key
- `land/video/generation/fish-speech-client.ts` — fal.ai Fish Speech, synchronous-style
- `land/voice/clone-voice.ts` — ElevenLabs voice cloning BYOK

**Rendering**
- `land/video/assembly/composer-ffmpeg.ts` — MoviePy Fly service, `/compose` + `/compose-rich`
- `land/video/assembly/ffmpeg-muxer.ts` — Cloudconvert REST API, 3s poll × 40 attempts
- `land/video/generation/video-render-provider.ts` — heygen/facefusion/wav2lip + mock rejection

**QA / validation**
- `land/validation/services.ts` — 5 validators with circuit breaker
- `land/video/templates/scene-detector.ts`, `highlight-scorer.ts` — pre-render analysis

**Delivery / publishing**
- `land/video/publishing/video-publishing.service.ts` — publishVideo(), retryVideo(), OAuth credentials, token refresh
- `land/video/publishing/publish-upload.ts` — ensureFreshToken(), provider dispatch
- `land/video/publishing/providers/` — 16 platform adapters
- `land/fulfillment/complete-video-from-webhook.ts` — webhook-triggered completion

---

## SECTION 14 — BOTTLENECK ANALYSIS

Top 10 architectural bottlenecks ranked by IMPACT × RISK × IMPLEMENTATION COST.
Each is evidenced with file:line citations.

### B1. No production image-generation capability (MISSING CELL — IMAGE)
**Rank:** 1 | **Score:** 9/10
**Impact:** High — thumbnails, scene stills, brand assets all require images. **Risk:** Medium (BYOK workaround exists). **Cost:** Medium (provider adapter + cost tracking).

Evidence:
- `seed/ai/providers/hermes-capabilities.ts` — explicitly declares **NO /v1/images endpoint** → `image.generate = UNSUPPORTED`. Hermes supports_vision=True is INPUT-only.
- `forest/ai/providers/mock-image-generation-provider.ts` — exists but is mock-only.
- `forest/ai/providers/openrouter-image-adapter.ts` (10 KB) — OpenRouter adapter exists but is not wired into the main video pipeline (no callers in `forest/video/` or `land/video/generation/`).
- No `image.generate` path in `forest/video/video-generate.ts` — the 9-step pipeline has NO image step.

Consequence: Sophia cannot produce thumbnails, scene stills, or brand assets natively. Every video either reuses the customer's BYOK to OpenRouter (unreliable, untracked) or ships without stills. This is the single missing cell that most blocks "factory" claims.

---

### B2. Single Inngest client — all workflows on one orchestration spine
**Rank:** 2 | **Score:** 8/10
**Impact:** High — one misconfiguration breaks all long-running jobs. **Risk:** Medium. **Cost:** Low (instantiation is already centralized; resilience patterns missing).

Evidence:
- `seed/inngest/client.ts:16` — ONLY Inngest client instantiation: `export const inngest = new Inngest({ id: "sophia-ai-factory", ... })`.
- `forest/inngest/functions/index.ts` — barrel re-export of ~20 functions (video-generate, video-publish, video-scripting, video-tts, video-visual, video-compose, video-upload, youtube-content-pipeline, agent-mission-lifecycle, agent-approval-gate, dunning-handler, etc.).
- No per-function concurrency isolation, no per-tenant rate limiting, no dead-letter queue for failed steps.

Consequence: One noisy tenant or one runaway function can starve the entire workflow engine. No blast-radius containment.

---

### B3. Synchronous DB client in async Inngest steps
**Rank:** 3 | **Score:** 8/10
**Impact:** High — D1 is synchronous (`createServerClient` is sync, no await). **Risk:** High (race conditions under load). **Cost:** Low (wrap in step.run).

Evidence:
- `forest/inngest/functions/video-tts.ts:76,96` — `const db = createServerClient();` called inside async step.
- `forest/inngest/functions/url-revenue-video-handler.ts:26` — `const db = createServerClient();` inside step.
- `seed/db/client.ts` — `createServerClient()` is synchronous by design (D1 binding is sync).
- `CLAUDE.md` line 31: "DB client (sync) — DO NOT await".

Consequence: Multiple concurrent Inngest steps on the same worker share one D1 binding with no transaction isolation. Under load, lost updates and read-after-write inconsistencies are likely. The `Result<T,E>` + atomic-lock pattern (`INSERT ... ON CONFLICT DO NOTHING`) is used in billing code but NOT consistently in video/creative cells.

---

### B4. Hermes security block — local SD server with no image generation
**Rank:** 4 | **Score:** 7/10
**Impact:** Medium — local Stable Diffusion server at `http://127.0.0.1:8100` is operator-side infra, violating no-tech doctrine. **Risk:** High (operator credential required). **Cost:** Medium (remove or make customer-side).

Evidence:
- `seed/ai/providers/hermes-antigravity-adapter.ts` (10 KB) — construction NEVER throws for missing credentials (silent degradation).
- `seed/ai/providers/hermes-capabilities.ts` — `supports_vision=True` is INPUT-only, `image.generate = UNSUPPORTED`.
- `sophia-no-tech-doctrine.md` — "Operator does NOT manage RaaS-side infra."

Consequence: Hermes is a local SD server that requires operator-side infrastructure. It cannot generate images (only vision). It violates the no-tech doctrine. It is dead weight in the provider registry.

---

### B5. Tier/pricing disconnect — static invoice IDs, no per-seat metering
**Rank:** 5 | **Score:** 7/10
**Impact:** Medium — billing is tier-based with static NOWPayments invoice IDs. **Risk:** Medium. **Cost:** Medium (dynamic pricing exists but is not wired to provisioning).

Evidence:
- `seed/config/tiers/tier-configs.ts` — `NOWPAYMENTS_INVOICE_IDS` is static: BASIC=5710519960, PREMIUM=4559269964, ENTERPRISE=6336799275, MASTER=5589879034.
- `land/billing/dynamic-pricing.ts` — exists but is not called by `tier-change-provisioner.ts`.
- `land/billing/usage-aggregator.ts` — aggregates usage but does not feed back to pricing.
- `land/billing/video-production-cost-engine.ts` — calculates production cost but is not linked to customer billing.

Consequence: Price changes require code changes (static invoice IDs). No usage-based overage beyond the `overage-topup.ts` flat top-up. No per-seat or per-render metering that would enable true factory pricing.

---

### B6. No unified factory scheduler — cells are not orchestrated
**Rank:** 6 | **Score:** 7/10
**Impact:** High — without a scheduler, "factory" is a metaphor, not a system. **Risk:** Low (current demand is manual). **Cost:** High (new subsystem).

Evidence:
- `land/factory/index.ts` (6 LOC), `url-product-extractor.ts` (110 LOC), `url-to-revenue.ts` (235 LOC) — 351 LOC total. Extremely thin.
- `land/video/generation/campaign-orchestrator.ts` — pure campaign workflow, no Inngest deps, imports `ServiceFactory`, `startVideoGeneration`, `OpenClawGateway`, `SmartResumeEngine`, `YouTubeChannelAdapter`. This is the closest thing to a factory scheduler but is campaign-specific, not cell-general.
- No `land/factory/scheduler.ts`, no `land/factory/cell-registry.ts`, no `land/factory/production-queue.ts`.

Consequence: Each cell (video, audio, billing, delivery) is triggered independently. There is no "what should we produce next" decision layer. The Intelligence Cell does not feed the Creative Cell which does not feed the Video Cell in a closed loop.

---

### B7. Publishing provider coverage — mock mode is the default for most platforms
**Rank:** 7 | **Score:** 6/10
**Impact:** Medium — most platforms fall back to mock when env vars are absent. **Risk:** Low (BYOK pattern). **Cost:** Low (env-var gating is intentional).

Evidence:
- `land/video/publishing/providers/mastodon.ts:16` — `return !process.env.MASTODON_INSTANCE_URL;` → mock mode when absent.
- `land/video/publishing/providers/youtube-publisher.ts` — mock mode when `YOUTUBE_CLIENT_ID` absent.
- `land/video/publishing/providers/tiktok-publisher.ts` — metrics API requires additional scope (returns placeholder).
- `land/video/generation/video-render-provider.ts:80-87` — mock provider REJECTED in production unless `SOPHIA_CORE_VIDEO_PROOF=1`.

Consequence: 16 platform adapters exist, but most require customer BYOK to escape mock mode. This is intentional (no-tech doctrine) but means the "Delivery Cell" is more of a delivery framework than a delivery capability. Customers must configure 5+ provider keys before any publish works.

---

### B8. No post-generation QA gate — videos ship without quality validation
**Rank:** 8 | **Score:** 6/10
**Impact:** Medium — bad videos damage customer brands. **Risk:** Medium. **Cost:** Medium (ML-based QA or human-in-the-loop).

Evidence:
- `land/validation/services.ts` — only validates API keys, not output quality.
- `land/video/templates/scene-detector.ts`, `highlight-scorer.ts` — pre-render analysis only.
- `forest/video/video-generate.ts` — 9-step pipeline has NO QA step between mux and upload.
- `land/video/publishing/video-publishing.service.ts` — `publishVideo()` has no quality gate.

Consequence: A video with silent audio, black frames, or mis-synced subtitles can be published directly to YouTube/TikTok. No automated QA, no human approval gate, no "reject and regenerate" loop.

---

### B9. Event orchestration duplication — Inngest vs direct-call patterns
**Rank:** 9 | **Score:** 5/10
**Impact:** Medium — two orchestration patterns create inconsistency. **Risk:** Medium. **Cost:** Medium (consolidation).

Evidence:
- `forest/inngest/functions/video-generate.ts` — full Inngest pipeline (9 step.run calls).
- `land/video/generation/campaign-orchestrator.ts` — pure function composition, NO Inngest deps, calls `startVideoGeneration` directly.
- `land/video/generation/video-job-pipeline.ts` — fires `video.requested` Inngest event.
- `land/fulfillment/complete-video-from-webhook.ts` — webhook-triggered, bypasses Inngest.

Consequence: Three orchestration patterns (Inngest event, direct call, webhook) with no single source of truth for "what happens after a video is requested". Debugging a failed video requires knowing which path was taken.

---

### B10. Test gaps — mock providers in production code paths
**Rank:** 10 | **Score:** 5/10
**Impact:** Medium — mock paths are tested, production paths less so. **Risk:** Medium. **Cost:** Medium (integration tests).

Evidence:
- `land/video/generation/video-render-provider.ts:59-87` — `submitMockProvider()` returns `mockVideoUrl = https://mock.sophia.local/videos/${videoId}.mp4` (a URL that resolves to nothing in production).
- `land/video/__tests__/video-render-provider.test.ts:28-29` — test only validates mock acceptance when `SOPHIA_CORE_VIDEO_PROOF=1`. No test for the production heygen path.
- `forest/inngest/functions/video-generate.test.ts` — exists but mocks all external calls.
- No end-to-end test that runs a real video through script→TTS→visual→compose→upload.

Consequence: The mock path is well-tested, the production path is not. A regression in the heygen/facefusion/wav2lip submit path would reach production before detection.

---

## Compact Summary Block

```
RECON 11 — FACTORY CELLS
Classification: F. Hybrid (video SaaS + workflow engine + factory-OS skeleton)
Cells: Intelligence=PARTIAL, Creative=Partial, Image=MISSING, Video=IMPLEMENTED,
       Audio=IMPLEMENTED, Render=PARTIAL, QA=PARTIAL, Billing=IMPLEMENTED, Delivery=IMPLEMENTED
Top bottleneck: B1 — No production image-generation cell (hermes-capabilities.ts = UNSUPPORTED)
Critical: B2 (single Inngest client), B3 (sync DB in async steps), B4 (Hermes violates no-tech doctrine)
Missing subsystem: Factory scheduler (land/factory/ = 351 LOC only)
Biggest gap between claim and reality: "AI Factory OS" requires a scheduler + image cell + QA gate,
                                   none of which exist. Current state = video SaaS on Inngest.
```
