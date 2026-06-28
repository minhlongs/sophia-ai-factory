# Video Production Technology Research — Synthesis Report

**Date:** 2026-05-22
**Scope:** 4 parallel research tracks + codebase audit
**Goal:** Identify latest video production tech for Sophia AI Factory, aligned with current architecture

---

## Current Stack (Codebase Audit)

| Provider | Type | Status | BYOK | Layer |
|----------|------|--------|------|-------|
| HeyGen | Avatar video | Active | Required | tree/byok → forest/missions |
| D-ID | Talking avatar | Active | Required | lib/did |
| Wan 2.1 (Replicate) | Text-to-video | Active | Platform | lib/video/wan21-client |
| Fish Speech (fal.ai) | TTS | Active | Platform | lib/video/fish-speech-client |
| OpenRouter | Script gen (LLM) | Active | Optional | tree/byok |
| ElevenLabs | Premium TTS | Available | Optional | tree/credentials |
| Cloudconvert | Audio/video mux | Active | Platform | forest/inngest |

**Architecture:** Workers (API + D1) → Inngest (async jobs) → Provider APIs → R2 storage

**Key gap:** No Remotion despite docs mentioning it. Video pipeline is entirely API-driven (HeyGen/Wan 2.1 render remotely, results stored in R2).

---

## Research Findings

### Track 1: AI Video Generation Landscape

**Text-to-Video (T2V) — Top 3 for Sophia:**

| Model | Quality | Cost | Duration | API | Vietnamese |
|-------|---------|------|----------|-----|-----------|
| **Kling 3.0** (Kuaishou) | High | $0.06-0.10/sec | 5-10s | REST | Prompts: EN only |
| **Sora 2** (OpenAI) | Premium | $0.30-0.50/sec | 5-20s | REST | Prompts: EN only |
| **Runway Gen-4** | High | $0.25/sec | Up to 60s | Enterprise only | EN only |

**Recommendation:** Replace Wan 2.1 with **Kling 3.0** as primary T2V (3-5x better price-performance, APAC-optimized). Keep Sora 2 as premium fallback for MASTER tier.

**AI Avatars — Current + Next:**

| Provider | Latest | Key Advance | Cost |
|----------|--------|-------------|------|
| HeyGen | Avatar IV | Interactive avatars, streaming | $1/min |
| Synthesia | Express-2 | 230+ avatars, 140 languages | $0.80/min |
| Hedra | Character-2 | Portrait-to-talking-head, open weights | $0.50/min |

**Recommendation:** Keep HeyGen as primary (existing integration works). Add **Hedra** as budget alternative for BASIC tier — lower cost, portrait-to-video is unique.

**Voice/TTS:**
- ElevenLabs: Vietnamese confirmed working, best quality
- Fish Speech: Current integration, adequate for English
- Cartesia: Ultra-low latency (~100ms), good for real-time use cases
- **Gap:** No Vietnamese voice cloning (ElevenLabs TTS works, but cloning is EN-centric)

**Open-Source (Self-Hostable):**
- HunyuanVideo 1.5 (Tencent): Apache 2.0, best open T2V, needs GPU ($3-8/hr)
- CogVideoX-5B: Good quality, 6s max
- **Not recommended for Sophia** — BYOK model means customers use commercial APIs, not self-hosted

### Track 2: Video Editing & Post-Production AI

**Must-Have Integrations:**

| Tool | Purpose | API Status | Cost | Priority |
|------|---------|-----------|------|----------|
| **AssemblyAI** | Auto-captions + Vietnamese | Production REST | Usage-based | P0 — enables multilingual SOPs |
| **Flux 2** | Thumbnail generation | Open-weight + API | $0.003/image | P1 — every video needs thumbnails |
| **GPT Image 2** | Premium thumbnails | OpenAI API | $0.04/image | P1 — DALL-E 3 deprecated May 2026 |
| **Suno** (via Evolink) | Background music | Aggregator API | $0.008/song | P2 — royalty-free music |
| **Descript API** | Text-based editing | Public beta | TBD | P3 — advanced editing SOP |

**Key insight:** Runway API requires Enterprise contract (5-figure annual, 3-6mo sales cycle). Defer unless MASTER tier demand justifies it.

**Deprecated/Dying:**
- Unscreen: Shutting down Dec 2025
- DALL-E 3: Deprecated May 2, 2026 → migrate to GPT Image 2
- CapCut API: No public API, but Seedance 2.0 (ByteDance T2V) rolling out in VN

### Track 3: Video Distribution & Monetization

**Platform API Maturity:**

| Platform | Upload API | Monetization | Automation Score |
|----------|-----------|--------------|-----------------|
| YouTube | Data API v3 (1600 units/upload, ~6/day) | $0.01-0.06/1K views (Shorts) | 7/10 |
| TikTok | Content Publishing API (5-6/min) | Shop affiliate 5-30% | 6/10 |
| Instagram | Graph API (Reels direct publish) | $0.01-0.05/1K views + Gifts | 8/10 |
| Facebook | Graph API | $0.02-0.20/1K views | 7/10 |
| LinkedIn | UGC Post API | No direct monetization | 5/10 |

**Compliance risk (CRITICAL):** YouTube banned thousands of faceless AI channels in early 2026. SOPs must teach creators to add branding/personality to avoid detection. Pure faceless + synthetic voice + template script = high ban risk.

**Content Repurposing:**
- Opus Clip, Vidyo.ai, Munch: Long→Short conversion
- **Reap.video:** Only tool with REST API + MCP for programmatic repurposing ($9.99/mo)
- Sophia opportunity: Build repurposing into SOP steps

**Vietnamese Market:**
- Zalo: 98% penetration, video monetization TBD (Q4 2026)
- TikTok VN: +148% YoY growth, Shop integration dominant
- Pricing expectation: $5-15/mo (vs $29-599 US)
- Payment: PayOS + MoMo (Polar doesn't support VND)

---

## Strategic Recommendations

### Immediate Actions (0-30 days)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | **Add Kling 3.0 as T2V provider** — replace Wan 2.1 as default | 3-5x better price/quality | Medium — new client + BYOK resolution |
| 2 | **Add AssemblyAI for auto-captions** — critical for multilingual SOPs | Unlocks Vietnamese content SOPs | Small — REST API, webhook-based |
| 3 | **Add thumbnail generation step** — Flux 2 or GPT Image 2 | Every video SOP needs thumbnails | Small — single API call per video |
| 4 | **Update faceless channel SOPs** — add branding/personality guidance | Reduces creator ban risk | Zero code — SOP content update |

### Medium-Term (30-90 days)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 5 | **Multi-provider T2V router** — Kling (default) → Sora 2 (premium) → Wan 2.1 (fallback) | Resilience + tier differentiation | Medium |
| 6 | **Add Hedra for budget avatars** — portrait-to-talking-head | Lower BASIC tier video costs by 50% | Medium — new client |
| 7 | **Background music SOP step** — Suno via Evolink aggregator | Complete video production pipeline | Small |
| 8 | **Content repurposing SOP** — long-form → Shorts/Reels/TikTok | New SOP category for marketplace | Medium |

### Architecture Fit

All recommendations fit Sophia's existing architecture:

```
seed/config/        → Add provider configs (kling, assemblyai, hedra, flux)
tree/byok/          → Extend resolve-user-api-key.ts for new providers
tree/credentials/   → Add provider entries to user_provider_credentials
lib/video/          → New clients: kling-client.ts, assemblyai-client.ts
forest/inngest/     → New pipeline steps or modify video-generate.ts
forest/missions/    → New handlers: thumbnail:generate, caption:generate
land/               → Cost constants for new providers
```

No architectural changes needed. The BYOK + Inngest async pipeline pattern scales to any REST API provider.

### Cost Impact (Per Video)

| Component | Current | Proposed | Savings |
|-----------|---------|----------|---------|
| T2V (5s clip) | $0.50 (Wan 2.1) | $0.30-0.50 (Kling 3.0) | ~20-40% |
| Avatar (1min) | $1.00 (HeyGen) | $0.50 (Hedra for BASIC) | 50% on BASIC |
| Captions | Manual | $0.01 (AssemblyAI) | New capability |
| Thumbnail | Manual | $0.003-0.04 (Flux/GPT) | New capability |
| Music | None | $0.008 (Suno) | New capability |
| **Total pipeline** | **~$1.50** | **~$0.85-1.05** | **30-45% cheaper** |

---

## Unresolved Questions

1. Kling 3.0 API: need to verify exact REST endpoint + auth mechanism (may need Kuaishou dev account)
2. Runway Enterprise: worth pursuing for MASTER tier? 5-figure annual minimum
3. Seedance 2.0 (ByteDance): copyright litigation pending — DO NOT depend on
4. Vietnamese voice cloning: ElevenLabs TTS works, but voice cloning quality in Vietnamese unverified
5. HeyGen cross-language lip-sync: does quality degrade when English avatar uses Vietnamese voice?
6. Zalo Video API: timeline for monetization program? API availability?
7. YouTube AI content policy: will disclosure requirements tighten further in 2026-2027?

---

## Sources

- 4 parallel research agents covering: AI video gen landscape, video editing/post-production, distribution/monetization, codebase audit
- 50+ authoritative sources: official APIs (OpenAI, Google, Kuaishou, Runway, CF), aggregators, community comparisons, Vietnamese market reports
- Full codebase scan of `apps/sophia-ai-factory/src/` across all 4 layers
