# Technical Research: Autonomous AI Live-Commerce Streamer & Fast-Track Newsjacking Engine

**Context:** Sophia AI Factory | **Deployment:** Cloudflare Workers + D1 + Inngest | **Constraints:** Serverless edge, BYOK, KISS, DRY, YAGNI

---

## 1. Pillar 1: Autonomous AI Live-Commerce Streamer

### 1.1 Architectural Evaluation & Source Benchmarks
- **RTMP Ingestion & Serverless Relay:** Cloudflare Stream Live Ingest supports direct RTMP/RTMPS & SRT ingest with WebRTC (WHIP/WHEP) playback (sub-second latency) and HLS fallback ([Cloudflare Stream Docs](https://developers.cloudflare.com/stream/)). For multi-platform restreaming (TikTok Live, Shopee Live, YouTube Live), headless FFmpeg on edge is impossible due to CF Worker 128MB RAM/CPU limits. Solution: Cloudflare Stream Live Inputs with automated output restreaming webhooks or lightweight external relay workers (AWS ECS Fargate on-demand container via BYOK API or Fal.ai/Livepeer RTMP broadcast API).
- **Loop Video Playlisting:** Serverless pre-rendered video looping. Seamless HLS/RTMP injection via Cloudflare Stream Live Inputs API (`/live_inputs/{id}/playback`) or dynamic MP4 manifest switching. Seamless playback loop maintained at player/ingest level without continuous server-side GPU rendering.
- **Low-Latency Comment-to-Voice Q&A:**
  - Ingestion: Platform webhook / SSE chat reader (TikTok Live Connector WebSocket / YouTube Live Chat API).
  - LLM Moderation & Answer Synthesis: OpenRouter `gpt-4o-mini` / `claude-3-5-haiku` streaming (TTFT ~250ms).
  - Voice Synthesis: ElevenLabs Flash v2.5 WebSocket streaming API (~75-100ms TTFB) ([ElevenLabs Docs](https://elevenlabs.io/docs/api-reference/text-to-speech-websockets)).
  - Total end-to-end latency: ~600-900ms, qualifying for real-time live interaction. Audio piped into live audio mixer track over WHIP.
- **Flash-Sale Overlay Pinning:** Dynamic CSS/HTML graphic overlays pushed via WebSocket to Stream overlay channel or Remotion serverless renderer. State stored in Cloudflare KV / D1 with millisecond sync.

### 1.2 Trade-Off & Evaluation Matrix
| Option | Ingest/Broadcast Architecture | Latency | Complexity | Cost / 1k Hours | Rank |
|---|---|---|---|---|:---:|
| **A: Cloudflare Stream + ElevenLabs Flash WebSocket (Recommended)** | CF Stream RTMP/WHIP + Edge Event Dispatch | <1.2s | Low | $35 (CF Stream) + BYOK TTS | **1** |
| **B: Self-Hosted OBS/FFmpeg ECS Fargate** | Dedicated Fargate Container running FFmpeg loop | 2-4s | High | $120+ (Compute + Egress) | **3** |
| **C: Livepeer Decentralized RTMP Transcoding** | Decentralized video pipeline | 3-5s | Medium | Variable | **2** |

---

## 2. Pillar 2: Real-Time Newsjacking & Viral Trend Hijacking Video Engine

### 2.1 Architectural Evaluation & Fast-Track Pipeline (Sub-120s SLA)
- **Signal Ingestion:**
  - Google Trends RSS (`https://trends.google.com/trending/rss`) + unofficial edge scrapers (free, zero auth, polled every 5 min via Inngest cron).
  - TikTok Creative Center trending hashtags API / rapid scrapers (polled hourly).
- **Affiliate Product Semantic Auto-Pairing:**
  - Embedding: Cloudflare Workers AI (`@cf/baai/bge-small-en-v1.5`) runs on-edge in <20ms.
  - Matching: Vector similarity against user's D1 product catalog (`product_embeddings` using D1 Vectorize or exact cosine match on top-100 catalog).
  - Prompt Template: "Why [Trend Headline] proves you urgently need [Product X]".
- **Sub-120s Fast-Track Video Generation Workflow:**
  1. *0-15s (Orchestration & Copy):* OpenRouter generates hook, 30s punchy newsjack script, and image prompts.
  2. *15-45s (Voice & Visuals):* Parallel execution — ElevenLabs Flash v2.5 generates audio (~2s); Fal.ai Flux Schnell generates 3 visual slides (~3s each, parallelized ~6s total).
  3. *45-90s (Rendering & Assembly):* Serverless Remotion Lambda / Cloudflare Images stitch MP4 with auto-captioning.
  4. *90-110s (Delivery & Notification):* D1 state recorded, video uploaded to R2, Telegram alert pinged via `@Sophia_Bbot` for instant 1-click publish approval.

### 2.2 Trade-Off & Evaluation Matrix
| Pipeline Strategy | Assembly Engine | Total Render SLA | Failure Blast Radius | Operational Fit | Rank |
|---|---|---|---|---|:---:|
| **Option 1: Parallel Modular Inngest + Fal.ai + Remotion (Recommended)** | Inngest step-functions + Fal Flux + Remotion | ~65-85s | Isolated per step (retryable) | Perfect (Serverless edge) | **1** |
| **Option 2: Monolithic FFmpeg worker** | Heavy container FFmpeg | ~110-140s | Container crash loses job | Poor (Violates CF edge doctrine) | **3** |
| **Option 3: Pure Slideshow + Canvas Remotion** | Browser-canvas MP4 stitcher | ~40-60s | Low visual fidelity | High, but lower conversion | **2** |

---

## 3. Adoption Risk & Architectural Fit
- **Adoption Risk:** Low. Builds strictly on verified primitives in codebase (Inngest, OpenRouter, ElevenLabs, Cloudflare D1/R2). No native heavy dependencies added to edge runtime.
- **Breaking-Change History:** ElevenLabs Flash v2.5 is backward-compatible with v1 WebSocket protocol; Google Trends RSS has been stable for 10+ years.
- **Architectural Fit (Sophia Doctrine):** Zero operator-side credentials required. All customer keys (Fal.ai, ElevenLabs, OpenRouter) injected via existing BYOK Setup Wizard.

---

## 4. Concrete Recommendations (Ranked)
1. **Live-Commerce:** Implement **Option A** — Cloudflare Stream Live Ingest paired with ElevenLabs Flash v2.5 WebSocket audio inject & D1 flash-sale pinning state machine.
2. **Newsjacking Engine:** Implement **Option 1** — Google Trends RSS / TikTok ingest cron dispatching an Inngest fast-track job: parallel Fal.ai Schnell + ElevenLabs + Remotion stitching (<90s total turnaround).

---

## 5. Limitations & Unresolved Questions
- **Limitations:** Multi-destination restreaming directly to proprietary mobile app endpoints (TikTok Live mobile rtmp keys) requires user-provided stream keys that rotate per session.
- **Unresolved Questions:**
  1. Does the target customer tier have pre-configured TikTok Live Stream Keys, or is live output restricted to YouTube/Twitch RTMP?
  2. For newsjacking, should video publication auto-post directly or default to human-in-the-loop Telegram approval?
