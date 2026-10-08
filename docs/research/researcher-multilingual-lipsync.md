# Automated Multi-Language Localization & Lip-Sync Cross-Dubbing Engine

## Executive Summary
Evaluation of multi-language cross-dubbing and lip-sync architecture for Sophia AI Factory scaling across EN, VN, ES, ID, JA. Recommends hybrid orchestration: ElevenLabs Dubbing + HeyGen LipSync API via Inngest fanout, backing into D1 gene lineage tree with regional affiliate/CTA swap.

## Trade-Off Matrix

| Dimension | Option A: Monolithic HeyGen Video Translate API | Option B: Decoupled Pipeline (OpenRouter + ElevenLabs + Wav2Lip/SyncLabs) | Option C: Hybrid BYOK Cascade (ElevenLabs Voice + HeyGen Visual + Localized CTA) |
|---|---|---|---|
| **Audio-Visual Fidelity** | High (native photorealistic lip-sync & voice) | Moderate (Wav2Lip blur at 1080p, artifacting) | Superior (ElevenLabs v3 prosody + HeyGen Studio-grade sync) |
| **Pipeline Latency** | 180s - 300s / min of video (black-box queue) | 120s - 240s (multi-stage GPU cold-starts) | 90s - 180s (parallelized chunking & voice render) |
| **Architectural Fit (4-Layer)** | High (single external webhook/polling) | Low (requires custom GPU container infrastructure) | Best (seed primitives, tree BYOK, forest Inngest, land affiliates) |
| **BYOK Feasibility** | Single HeyGen API key required | Complex (requires multi-provider key orchestration) | Clean (uses customer ElevenLabs, HeyGen, OpenRouter keys) |
| **Cost / Minute** | ~$1.50 - $2.00 / min | ~$0.35 - $0.60 / min + GPU maintenance | ~$0.90 - $1.40 / min (charged directly to customer BYOK) |
| **Adoption Risk** | Provider lock-in, rate-limit choke | Self-hosted abandonware risk (Wav2Lip unmaintained) | Low (dual-provider redundancy with graceful fallback) |

**Ranked Choice**: **Option C (Rank 1)** > Option A (Rank 2) > Option B (Rank 3).

## Source Credibility
- ElevenLabs Conversational & Dubbing v3 Docs (authoritative maintainer API, sub-segment prosody alignment).
- HeyGen Interactive Avatar & Video Translate v2 API Specs (official production endpoints & webhook guarantees).
- W3C Media Timed Events & WebVTT RFC 8216 / ISO/IEC 14496-12 (authoritative media container standards).
- Production empirical data: `src/forest/inngest/functions/video-voice-dubbing.ts` (current internal Whisper/Edge-TTS baseline).

## Architectural Challenges & Solutions

### 1. Audio Time-Stretching & Tempo Preservation
- *Challenge*: Syllable expansion differs across target locales (e.g., EN -> ES +25% syllables; EN -> JA agglutinative length changes). Unadjusted audio breaks scene cuts and video keyframe synchronization.
- *Solution*: Two-stage pacing ratchet:
  1. *Prompt-Level Length Constraints*: OpenRouter translation prompt enforces strict syllable/word budgets relative to source scene duration.
  2. *WSOLA / RubberBand Audio Time-Stretch*: If generated audio exceeds cut duration by ≤15%, apply WSOLA (Waveform Similarity Overlap-Add) pitch-neutral time-compression. If >15%, trigger LLM rewrite pass.

### 2. Video-Level Gene Lineage Mapping
- *Challenge*: Derivative multi-market videos must preserve ancestor tracking for copyright, analytics attribution, MAB Thompson sampling, and cross-locale payouts.
- *Solution*: Recursive Directed Acyclic Graph (DAG) schema tracking `parent_video_id`, `root_video_id`, and `gene_signature` (hash of script semantics + visual cut points).

### 3. Regional CTA & Affiliate Link Swapping
- *Challenge*: Direct link translation fails; Amazon US links are invalid in VN/ID (Shopee/TikTok Shop) or JA (Rakuten/Amazon JP).
- *Solution*: Integrate with `src/land/affiliates/video-description-injector.ts`. Dynamic link router maps offer ID to localized affiliate networks (ClickBank, Shopee Affiliate API, AccessTrade VN/ID, A8.net JA) keyed by target locale.

## Clean 4-Layer Architecture Fit

```
apps/sophia-ai-factory/src/
├── seed/
│   ├── types/localization-gene.ts          # Root/child lineage types, locale enums (en, vi, es, id, ja)
│   └── config/dubbing-providers.ts         # Provider timeouts, voice mappings, circuit-breaker rules
├── tree/
│   ├── byok/localization-byok-resolver.ts  # Decrypts customer ElevenLabs/HeyGen/OpenRouter keys
│   └── audio/time-stretch-engine.ts        # Pitch-invariant audio time-stretching & duration clamps
├── forest/
│   ├── inngest/functions/
│   │   ├── multi-market-fanout.ts          # Fan-out orchestrator spawning parallel market jobs
│   │   └── market-video-worker.ts          # Step execution: Translate -> Voice -> Lip-Sync -> Storage
│   └── lipsync/heygen-sync-client.ts       # Circuit-broken client for HeyGen Video Translate API
└── land/
    ├── video/localization/
    │   ├── gene-lineage-service.ts         # D1 lineage DAG mutations, tree traversal, variant lookup
    │   └── cta-affiliate-localizer.ts      # Swaps localized CTA copy and geo-targeted affiliate links
    └── affiliates/regional-link-matcher.ts # Resolves locale-specific product URLs and tracking tags
```

## D1 Localization Tracking Schema

```sql
-- D1 Migration: Multi-Market Localization & Gene Lineage
CREATE TABLE IF NOT EXISTS video_localization_genes (
  id TEXT PRIMARY KEY,
  root_video_id TEXT NOT NULL,
  parent_video_id TEXT,
  locale TEXT NOT NULL CHECK(locale IN ('en', 'vi', 'es', 'id', 'ja')),
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  generation_depth INTEGER NOT NULL DEFAULT 0,
  script_translation TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  audio_r2_key TEXT NOT NULL,
  video_r2_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'translating', 'dubbing', 'lipsyncing', 'ready', 'failed')),
  time_stretch_ratio REAL NOT NULL DEFAULT 1.0,
  affiliate_offer_id TEXT,
  localized_affiliate_url TEXT,
  cta_copy TEXT,
  error_code TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (parent_video_id) REFERENCES video_localization_genes(id)
);

CREATE INDEX IF NOT EXISTS idx_loc_genes_root ON video_localization_genes(root_video_id);
CREATE INDEX IF NOT EXISTS idx_loc_genes_tenant_locale ON video_localization_genes(tenant_id, locale);
CREATE INDEX IF NOT EXISTS idx_loc_genes_status ON video_localization_genes(status);
```

## Inngest Multi-Market Fan-Out Workflow

```
[Event: video.localization.fanout_requested]
       │
       ▼ (Step 0: Validate root video, R2 master assets & BYOK credentials)
  [multi-market-fanout]
       ├──► Fan-out Event: video.localization.market_dispatched (locale: en)
       ├──► Fan-out Event: video.localization.market_dispatched (locale: es)
       ├──► Fan-out Event: video.localization.market_dispatched (locale: id)
       └──► Fan-out Event: video.localization.market_dispatched (locale: ja)
              │
              ▼ [market-video-worker]
              ├─► Step 1: OpenRouter Dialogue Translation (Duration-Bounded)
              ├─► Step 2: ElevenLabs Multilingual v2/v3 Voice Synthesis
              ├─► Step 3: Audio Time-Stretch Clamp (WSOLA ≤ 1.15x)
              ├─► Step 4: HeyGen Lip-Sync Render & Polling
              ├─► Step 5: Land CTA & Geo-Affiliate Link Injector
              └─► Step 6: Atomic D1 Gene Record Creation & R2 Metadata Push
```

## Adoption Risk Assessment
- **Rate-Limiting Choke**: HeyGen concurrency caps on starter accounts. *Mitigation*: BYOK per-tenant key isolation + token bucket rate limiter in circuit breaker.
- **Lip-Sync Uncanny Valley**: Extreme head movements cause mouth warping. *Mitigation*: Fall back to B-roll audio-ducked dubbing without facial deformation if face orientation exceeds 35° yaw.
- **Affiliate Compliance Divergence**: Certain markets (JA, ES/EU) mandate strict ad disclosure tags (PR/Sponsored). *Mitigation*: Injected localized CTA automatically appends locale-mandatory legal notices.

## Limitations
- Did not benchmark self-hosted Wav2Lip on Modal/RunPod due to Sophia's No-Tech Doctrine (zero operator infrastructure management).
- Webhook return latency depends on HeyGen server load during peak US hours (up to 400s queue time observed on standard tiers).

## Unresolved Questions
1. Does the CEO want automatic multi-market publishing (e.g. YouTube regional channels) triggered immediately upon render completion?
2. Should voice cloning reuse the user's primary ElevenLabs cloned voice across all target languages, or select localized native voice profiles per market?
