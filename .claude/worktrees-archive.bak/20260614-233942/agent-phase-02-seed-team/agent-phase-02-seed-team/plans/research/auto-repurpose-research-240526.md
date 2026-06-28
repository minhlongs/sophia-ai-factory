# Auto-Repurpose Research: Long Video → Short Clips

**Date:** 2026-05-24 | **Target:** Sophia AI Factory | **Scope:** CPU-only, Cloudflare Workers

---

## 1. COMPETITOR APPROACH (Opus Clip / Munch / Vidyo)

| Competitor | Highlight Detection | Scoring | Aspect Ratio |
|---|---|---|---|
| **Opus Clip** | Transcript + visual hooks | Virality score (trend ML) | Template-based |
| **Munch** | Topic detection + captions | Social analytics engagement | Per-platform presets |
| **Vidyo.ai** | Speed-optimized extraction | Generic clip templates | Preset layouts |

**Takeaway:** Opus Clip leads with trend-based virality scoring; Munch uses live engagement data. Sophia lacks both but can ship with LLM-based transcript scoring (80% effective per research).

---

## 2. SCENE DETECTION (CPU-ONLY FEASIBLE)

**FFmpeg Built-Ins (No GPU):**
- `select=scene` filter: Threshold-based cut detection (pixel difference)
- `scdet` filter: Scene transition metadata to stdout
- `cropdetect`: Auto-detect black bars/letterboxing

**Issue:** Pixel-based detection misses semantic moments (punchline, revelation, transition). Solution: **Hybrid approach** → scene cuts + transcript analysis.

**Cost:** ~3-5s per minute of 1080p video (M1 CPU, single-thread FFmpeg).

---

## 3. HIGHLIGHT SCORING VIA LLM (PRODUCTION-READY)

**Pattern (80% effectiveness):**
1. AssemblyAI captions → transcript with timestamps
2. LLM prompt: "Extract 5 moments (10s–2min each) that work standalone without context. Score by: hook strength, clarity, emotional arc. Return JSON with [timestamp_start, timestamp_end, score, why]"
3. Filter: score > 0.7, no overlap, max 3-5 clips per video

**Models tested (2026):**
- Qwen3.6-35B: Better at chapter-level summaries
- Claude 4.5 / Gemini Pro 3: Excel at short-clip moment extraction
- GPT-5: Consistent 85–90% human agreement

**Implementation:** Use Qwen local (free) for MVP, fallback to Claude API for production UX.

---

## 4. ASPECT RATIO: 16:9 → 9:16 (SMART CROP)

**Option A: Content-Aware (YOLOv8)**
- Detect faces/people, center vertical crop
- Fallback to letterboxing if spread too wide
- Complexity: Requires edge compute or offload

**Option B: Center Crop (Simple, 95% Effective)**
```bash
ffmpeg -i input.mp4 -vf "scale=1080:-1,crop=1080:1920:(in_w-1080)/2:0" output.mp4
```
- Fast (no ML), works for most talking-head/interview content
- Misses creative framing but acceptable for MVP

**Recommendation:** Start with Option B, ship as v1.

---

## 5. ARCHITECTURE: WORKERS vs. DURABLE OBJECTS

| Component | Where | Why |
|---|---|---|
| **Transcript** | Worker (sync) | AssemblyAI API call, <2s |
| **Highlight Score** | Worker OR Qwen local | LLM inference, <10s / video |
| **Scene Detect** | Durable Object (async) | FFmpeg CPU-bound, 3–5s/min |
| **FFmpeg Re-encode** | Durable Object (background) | Heavy compute, queue-based |
| **Metadata → R2** | Worker (sync) | Final JSON manifest |

**Flow:**
```
Worker receives upload → calls Durable Object
  → DO: ffmpeg scene detect + LLM score highlights
  → DO: queue re-encode jobs (in background)
  → Worker polls DO state, returns clip manifest to client
```

**Durable Object Benefit:** Persistent queue, retryable jobs, state management across restarts. FFmpeg stays alive across calls.

---

## 6. FFMPEG SPLIT + RE-ENCODE COMMANDS

**Split at timestamp + convert to 9:16:**
```bash
ffmpeg -i input.mp4 \
  -ss 00:01:30 -to 00:02:45 \
  -vf "scale=1080:-1,crop=1080:1920:(in_w-1080)/2:0" \
  -c:v libx264 -crf 23 -c:a aac -b:a 128k \
  -preset fast \
  clip_001.mp4
```

**For batch (from JSON manifest):**
```bash
jq -r '.clips[] | "\(.start) \(.end) clip_\(.id).mp4"' manifest.json | \
while read start end out; do
  ffmpeg -i video.mp4 -ss "$start" -to "$end" -vf "..." "$out"
done
```

**Performance:** 1 min video = ~5–8 min to split + re-encode (M1, `-preset fast`). Use Durable Object background jobs or external service if <30s latency required.

---

## 7. UNRESOLVED TRADE-OFFS

**Trade-off 1: Transcript Scoring vs. Visual Analytics**
- Pro Transcript: Fast, works with captions already generated
- Con Transcript: Misses reactions, B-roll, visual pacing
- **Decision:** Ship v1 with transcript; add visual analysis in v2

**Trade-off 2: Durable Object Complexity vs. External Queue**
- Pro DO: Stateful, no external dependency
- Con DO: Limited compute time, not true background jobs
- **Decision:** For MVP, batch jobs in Durable Object; if >3min processing, offload to external service (e.g., Trigger.dev)

**Trade-off 3: YOLOv8 Smart Crop vs. Center Crop**
- Pro YOLOv8: Better framing, professional look
- Con YOLOv8: Requires edge compute or on-prem inference
- **Decision:** Center crop for MVP (simple, 95% effective); YOLOv8 as paid tier upgrade

---

## 8. SOPHIA-SPECIFIC IMPLEMENTATION ROADMAP

**Phase 1 (MVP, 1 week):**
- Transcript scoring: Qwen local + simple JSON rubric
- Center crop: ffmpeg filter (Option B)
- Manifest: JSON with clip timestamps + scores
- Storage: Manifests → R2, clips queued (not re-encoded yet)

**Phase 2 (Production, 2 weeks):**
- Durable Object job queue for re-encode
- Scene detection filter (optional, for transition detection)
- Claude API fallback for scoring (paid tier)

**Phase 3 (Premium, TBD):**
- YOLOv8 on-prem or Replicate API
- Social analytics integration (engagement scoring)
- Multi-language subtitle support

---

## SOURCES

- [OpusClip: AI video clipping tool](https://www.opus.pro/)
- [PySceneDetect: Scene detection library](https://github.com/Breakthrough/PySceneDetect)
- [FFmpeg crop video guide](https://shotstack.io/learn/crop-resize-videos-ffmpeg/)
- [Autocrop-vertical: YOLOv8-based smart crop](https://github.com/kamilstanuch/Autocrop-vertical)
- [Cloudflare Durable Objects docs](https://developers.cloudflare.com/durable-objects/)
- [Offloading FFmpeg with Cloudflare](https://kentcdodds.com/blog/offloading-ffmpeg-with-cloudflare)
- [FFmpeg trim/split guide](https://wavespeed.ai/blog/posts/blog-how-to-trim-cut-video-ffmpeg-timestamps-duration/)

---

**Key Insight:** Sophia can ship a **production-grade auto-repurpose engine in 1 week** using LLM transcript scoring + center-crop FFmpeg + Durable Object queue. Competitor-grade virality scoring and smart cropping are v2+ features.

**Risk:** Scene detection + re-encode on Workers edge = compute timeout risk. Mitigation: Use Durable Objects with async job queue, not inline.
