# Video Factory v2 — Market-Leading AI Video Platform

**Goal:** Push Sophia's Video Factory to strongest-in-market position against Pictory, Synthesia, Opus Clip, InVideo.
**Status:** PLANNING
**Created:** 2026-05-24

## Current State

~90 files, ~5200 LOC. 3 video engines (HeyGen, Kling 3.0, Wan2.1), 2 TTS (ElevenLabs, Fish Speech), FFmpeg composition, Inngest pipeline, R2 storage, AssemblyAI captions.

## Phases

| # | Phase | Priority | Status | Est |
|---|-------|----------|--------|-----|
| 01 | [Brand Kit Enforcement](phase-01-brand-kit.md) | P1 | COMPLETED | 3-4d |
| 02 | [Batch Video Generation](phase-02-batch-generation.md) | P0 | TODO | 3-5d |
| 03 | [Auto-Repurpose Long→Shorts](phase-03-auto-repurpose.md) | P0 | COMPLETED | 5-7d |
| 04 | [Multi-Channel Publish: YouTube](phase-04-publish-youtube.md) | P0 | TODO | 3-4d |
| 05 | [Per-Video Analytics](phase-05-video-analytics.md) | P0 | TODO | 4-5d |
| 06 | [Multi-Channel Publish: TikTok + Instagram](phase-06-publish-tiktok-instagram.md) | P1 | TODO | 4-5d |
| 07 | [A/B Thumbnails + Template Marketplace](phase-07-thumbnails-marketplace.md) | P2 | TODO | 3-4d |

## Dependency Graph

```
Phase 01 (Brand Kit) ──┐
                       ├──→ Phase 02 (Batch Gen) ──→ Phase 03 (Auto-Repurpose)
                       │
                       └──→ Phase 04 (YouTube Publish) ──→ Phase 05 (Analytics)
                                                       ──→ Phase 06 (TikTok+IG)
                                                                     │
                                                          Phase 07 ←─┘
```

Phase 01 first (brand kit assets are composed into every video). Phases 02-03 and 04-06 can run in parallel tracks after 01.

## Architecture Decisions

- **Inngest fan-out** for batch generation (proven pattern, independent failure domains)
- **LLM transcript scoring** for auto-repurpose (no GPU needed, 85-90% human agreement)
- **Adapter pattern** for multi-channel publish (PlatformAdapter interface)
- **D1** for all metadata (batch_jobs, brand_kits, video_analytics, publish_status)
- **R2** for brand assets, video clips, thumbnails
- **BYOK** for all platform credentials (YouTube OAuth, TikTok tokens, etc.)

## Research Reports

- `plans/reports/researcher-batch-video-generation-architecture.md`
- `plans/research/auto-repurpose-research-240526.md`
- `plans/reports/researcher-multi-channel-video-publishing-2026-05-24.md`
- (analytics + brand kit inline in researcher output)

## Risk

- TikTok API review: 2-6 weeks manual review. Start immediately, fallback to manual posting.
- FFmpeg on CF Workers: CPU-bound, may hit 30s limit. Offload to Durable Objects for >1min jobs.
- D1 100KB statement limit: batch inserts in 50-100 video chunks.
