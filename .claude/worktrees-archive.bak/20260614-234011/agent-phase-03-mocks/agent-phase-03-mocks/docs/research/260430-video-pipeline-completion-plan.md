# Video Pipeline Completion — Research Report
**Date:** 2026-04-30 | **Project:** Sophia AI Factory

## TL;DR
4 stubs to fill. 3 are easy. 1 (visual generation) is expensive. 1 (compose) may be pointless — most video APIs return complete mp4. **Brutal truth:** Remotion SSR on Cloudflare Workers = impossible. HunyuanVideo on Replicate = $1.27+ per 5s video. OpenRouter scripting = $0.002/video.

---

## 1. video-scripting.ts — OpenRouter Script Generation

### Current State
Stub writes `[STUB] Auto-generated script...` to `video_jobs.script_text`. Existing `lib/ai/script-generator.ts` already makes real OpenRouter calls — just not from the Inngest function.

### How to Complete
Replace `stub-script-generation` step.run() with a real call:

```typescript
// Inside video-scripting.ts, step.run('generate-script', ...)
// Use the existing generateScript() from lib/ai/script-generator.ts
// OR call OpenRouter directly (preferred — avoids BYOK complexity in Inngest):
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "X-Title": "Sophia AI Factory",
  },
  body: JSON.stringify({
    model: "openai/gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a video script generator. Output JSON: {title, scenes[{narration,visual}]}" },
      { role: "user", content: job.prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 1000,
  }),
});

const data = await response.json();
const script = JSON.parse(data.choices[0].message.content);
// Persist script_text, then emit video.script.ready
```

### Model Choice
| Model | Cost (per 1M tokens) | Latency | Best For |
|-------|---------------------|---------|----------|
| `openai/gpt-4o-mini` | $0.15 in / $0.60 out | ~1.5s | Default — cheap, fast |
| `anthropic/claude-sonnet-4.6` | $3 in / $15 out | ~3s | Enterprise tier |
| `google/gemini-2.5-flash` | $0.15 in / $0.60 out | ~1s | Budget alt |

**Recommendation:** `gpt-4o-mini` for BASIC/PREMIUM tiers, Sonnet for ENTERPRISE. Estimated cost: **$0.001–0.005 per script** (~1K tokens out).

### Already Done
- `lib/ai/script-generator.ts` — working OpenRouter call + BYOK + LLM cache
- `lib/ai/script-prompt-builders.ts` — system prompt + output format
- `lib/ai/llm-router.ts` — model selection by complexity/tier
- `OPENROUTER_API_KEY` validated in `env-validation.ts`

### Effort: **1–2 hours** — wire existing code into Inngest step.

---

## 2. video-visual.ts — Visual/Video Generation

### Current State
Stub sets `visual_r2_key` to unsaved key string. No actual generation.

### Options

#### A. HunyuanVideo on Replicate (~$1.27/video)
Open-source model. Good quality. Async: submit → poll → download. On 4×H100, ~4 min runtime.

```typescript
// Submit
const prediction = await fetch("https://api.replicate.com/v1/predictions", {
  method: "POST",
  headers: { Authorization: `Token ${process.env.REPLICATE_API_KEY}` },
  body: JSON.stringify({
    version: "tencent/hunyuan-video:4c1a8b8...",
    input: { prompt: scene.visual, num_frames: 61, fps: 24 },
  }),
});

// Poll (they offer webhooks too)
// Once complete, download .mp4 from prediction.output
```

**Cost:** $1.27 per ~5s clip. **Replicate API key needed.** Can use webhook callback to avoid Inngest step timeout.

#### B. Wan 2.1 on Replicate ($0.09–0.25/sec output)
Newer, faster. Wavespeed-optimized version available.
- 480p: $0.09/sec output
- 720p: $0.25/sec output
- 5s clip @480p: ~$0.45

#### C. HeyGen (ALREADY INTEGRATED) — best for talking-head videos
`lib/heygen/heygen-client.ts` is production-ready. BUT: HeyGen = avatar talking-head, NOT generative B-roll. If the video script describes visual scenes (not just narration), HeyGen won't work.

#### D. RunwayML Gen-4 ($0.01/credit, ~$0.50–1.00/video)
Best quality. API: `api.runwayml.com`. Supports text-to-video AND image-to-video.

#### E. D-ID (ALREADY HAS ENV KEY)
`DID_API_KEY` validated in env. Talking-head avatar. Similar limitation to HeyGen.

### Recommendation
1. **Phase 1 (quick win):** Wire HeyGen or D-ID for MVP — generates complete talking-head videos with audio. One API call, skips compose step entirely. Already integrated.
2. **Phase 2 (generative B-roll):** Add Replicate with Wan 2.1 for text-to-video scenes. Requires async polling + R2 upload of generated mp4.

### Cost Estimates
| Provider | Cost per 30s video | Latency | Quality |
|----------|-------------------|---------|---------|
| HeyGen | $0.30–2.00 | 2–10 min | Talking head only |
| D-ID | $0.05–0.50 | 1–5 min | Talking head only |
| Wan 2.1 (Replicate) | $2.70 (6×5s clips) | 15–30 min | Generative B-roll |
| HunyuanVideo (Replicate) | $7.62 (6×5s clips) | 20–50 min | Generative B-roll |
| RunwayML Gen-4 | $3.00–6.00 | 10–30 min | Best generative |

### Effort: **4–8 hours** (HeyGen/D-ID path) or **2–3 days** (Replicate generative path).

---

## 3. video-compose.ts — Audio + Visual Composition

### Current State
Stub sets `final_r2_key` but does nothing.

### CRITICAL: Remotion SSR does NOT work on Cloudflare Workers
- `@remotion/renderer` requires Node.js (puppeteer, child_process, Chromium)
- Workers runtime = V8 isolates, no Node APIs, 30s CPU limit, 128MB memory
- Remotion Cloud Run = GCP only, alpha status, not actively developed per docs

### Options

#### A. SKIP ENTIRELY (Recommended for Phase 1)
If video-visual uses HeyGen/D-ID → output is already a complete mp4 with audio. Compose step is **unnecessary**. Mark as no-op, transition directly to uploaded.

#### B. FFmpeg WASM (Partial, fragile)
`@ffmpeg/ffmpeg` WASM can run in Workers but:
- 128MB memory limit = struggles with >10MB video
- No hardware acceleration
- Slow (5–10x real time)
- HLS/DASH only, no mp4 muxer in WASM build

**Verdict:** Not production-viable for video composition.

#### C. Separate microservice (GCP Cloud Run / Fly.io / Railway)
- Run Remotion SSR or FFmpeg in a Docker container
- Call via HTTP from Inngest step
- Pass R2 URLs for audio + visual, return composed R2 key

```typescript
// Inngest step calls external compose service:
const composeResp = await fetch("https://compose.sophia.agencyos.network/render", {
  method: "POST",
  body: JSON.stringify({ audioUrl, visualUrl, jobId }),
});
// Returns { finalR2Key, durationSec }
```

#### D. Stream stitching (hacky, no re-encoding)
If both audio and visual are in compatible formats (H.264 + AAC), concatenate streams without re-encoding using R2 Multipart Upload + manual MP4 atom manipulation. Fragile, format-dependent.

### Recommendation
- **Phase 1:** Skip compose. Use HeyGen/D-ID which produce complete videos.
- **Phase 2:** Deploy a minimal FFmpeg Docker container on Fly.io or GCP Cloud Run. Inngest step POSTs to it.

### Effort: **0 hours** (skip) or **1–2 days** (compose microservice).

---

## 4. video-upload.ts — R2 Upload + Publish

### Current State
Stub — transitions to `uploaded` status only, no actual upload.

### How to Complete (TRIVIAL)
The file is ALREADY in R2 if composed by the compose step (or by HeyGen download → R2 as in `video-storage-service.ts`). The upload step should:

1. Verify `final_r2_key` exists in R2
2. Generate public URL (`${R2_PUBLIC_BASE_URL}/${final_r2_key}`)
3. Update `video_jobs` with public URL
4. Emit `video.uploaded`

```typescript
// In upload step:
const { bucket, publicBaseUrl } = await getVideoBucket();
const head = await bucket.head(finalKey);
if (!head) throw new Error("Final video not found in R2");

const publicUrl = publicBaseUrl
  ? `${publicBaseUrl}/${finalKey}`
  : `https://pub-sophia.r2.dev/${finalKey}`; // fallback

await db.from('video_jobs').update({
  video_url: publicUrl,
  status: 'uploaded',
  updated_at: now,
}).eq('id', jobId);
```

If visual step uses external API (HeyGen/Replicate), download temp URL → R2 first:

```typescript
const resp = await fetch(tempVideoUrl);
const buffer = await resp.arrayBuffer();
await bucket.put(r2Key, buffer, { httpMetadata: { contentType: 'video/mp4' } });
```

**Already implemented:** `lib/video/video-storage-service.ts` does exactly this for HeyGen URLs.

### Effort: **1–2 hours** — mostly wiring + verification.

---

## 5. Cost Summary (per 30s video)

| Step | Provider | Cost Estimate |
|------|----------|---------------|
| video-scripting | OpenRouter (gpt-4o-mini) | $0.002 |
| video-tts | Coqui XTTS v2 (self-hosted) | $0 (hosting ~$20/mo on Fly) |
| video-visual (talking head) | HeyGen | $0.50–2.00 |
| video-visual (generative) | Replicate Wan 2.1 | $2.70 (6 scenes × 5s) |
| video-compose | N/A (skip if HeyGen) | $0 |
| video-compose (FFmpeg svc) | Fly.io 256MB | ~$0.001/video |
| video-upload | Cloudflare R2 | ~$0 (free tier) |
| **TOTAL (Phase 1 MVP)** | | **~$0.55–2.00/video** |
| **TOTAL (Full generative)** | | **~$3.00–8.00/video** |

---

## 6. Architecture Decision: What's Actually Feasible

### Cloudflare Workers CAN do:
- OpenRouter API calls (HTTP fetch) ✅
- Replicate API calls (HTTP fetch + webhook) ✅
- HeyGen/D-ID API calls (HTTP fetch + webhook) ✅
- R2 put/get/head/multipart ✅
- Polling (via Inngest steps) ✅
- Simple text processing ✅

### Cloudflare Workers CANNOT do:
- Remotion SSR (needs Node.js + Chromium) ❌
- FFmpeg WASM at scale (128MB memory limit) ❌
- GPU compute (obviously) ❌
- Long-running CPU tasks (30s limit per request) ❌

### Recommended Architecture

```
┌─────────────────────────────────────────────────────┐
│ Inngest Pipeline (Cloudflare Workers)               │
│                                                     │
│  video-scripting ──→ OpenRouter API                 │
│       │                                             │
│  video-tts ──→ /api/internal/tts ──→ Coqui Fly.io  │
│       │                                             │
│  video-visual ──→ HeyGen / Replicate API            │
│       │                     │                       │
│  video-compose ──→ SKIP (or external FFmpeg svc)    │
│       │                                             │
│  video-upload ──→ R2 (put + generate URL)           │
│       │                                             │
│  video-publish ──→ D1 (update status)               │
└─────────────────────────────────────────────────────┘
```

---

## 7. Implementation Priority

| Priority | Step | Action |
|----------|------|--------|
| **P0** | video-scripting | Wire existing OpenRouter call (1–2h) |
| **P0** | video-upload | Verify R2 key + generate public URL (1–2h) |
| **P1** | video-visual | Integrate HeyGen or D-ID for talking-head MVP (4–8h) |
| **P1** | video-publish | Already works, just needs `video_url` populated |
| **P2** | video-compose | Skip for MVP; add FFmpeg microservice later (1–2d) |
| **P2** | video-visual (gen) | Add Replicate/Wan for generative B-roll (2–3d) |

---

## 8. Unresolved Questions

1. **What type of videos?** Talking-head (HeyGen/D-ID) or generative B-roll (HunyuanVideo/Wan)? Affects entire pipeline.
2. **Video length target?** 30s, 60s, 3 min? Affects TTS cost and visual step count.
3. **Is the 6-step pipeline even needed?** HeyGen/D-ID go prompt→video in one API call. The pipeline is overengineered unless doing custom frame-by-frame synthesis.
4. **Compose microservice hosting budget?** If needed, Fly.io (free tier) or GCP Cloud Run ($0). Who maintains it?
5. **Tenant isolation for R2?** Current `tenantScopedKey` pattern works. Public URL base already configured via `R2_PUBLIC_BASE_URL`.
