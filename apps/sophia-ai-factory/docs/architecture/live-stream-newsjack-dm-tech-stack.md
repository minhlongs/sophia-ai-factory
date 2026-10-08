# Tech Stack: Autonomous Live Streamer, Newsjacking Engine & DM Closer Trilogy

**System:** Sophia AI Factory | **Deployment:** Cloudflare Workers + D1 + Inngest | **Status:** APPROVED  
**Architecture:** Clean Architecture (seed -> tree -> forest -> land) | **Doctrine:** BYOK, Zero Operator Infra

---

## 1. Pillar 1: Autonomous AI Live-Commerce Streamer & Virtual Host
- **RTMP Ingestion & Playlisting:** Cloudflare Stream Live Ingest (`/live_inputs`) with sub-second WebRTC (WHIP/WHEP) playback. HLS dynamic manifest looping without server-side GPU rendering.
- **Low-Latency Comment-to-Voice Q&A:**
  - Chat Listener: SSE/WebSocket comment stream.
  - LLM Moderation & Q&A: OpenRouter `gpt-4o-mini` streaming (TTFT ~250ms).
  - Voice Synthesis: ElevenLabs Flash v2.5 WebSocket streaming API (~75-100ms TTFB), total pipeline <900ms.
- **Flash-Sale Overlay Pinning:** D1 state machine + edge broadcast broadcasting deal countdown, scarcity badges, and affiliate shortlinks to video overlay.

---

## 2. Pillar 2: Real-Time Newsjacking & Viral Trend Hijacking Video Engine
- **Trend Signal Ingestion:** Edge cron polling Google Trends RSS (`trends.google.com/trending/rss`) + TikTok Creative Center API.
- **Semantic Product Pairing:** Cloudflare Workers AI (`@cf/baai/bge-small-en-v1.5`) computing 384-dim embeddings (<20ms) matched against D1 affiliate product vector catalog via cosine similarity.
- **Sub-120s Fast-Track Video SLA:**
  - 0-15s: OpenRouter script generation (hook, angle, image prompts).
  - 15-45s: Parallel Fal.ai Flux Schnell visual generation (~6s) + ElevenLabs Flash audio (~2s).
  - 45-90s: Serverless Remotion Lambda / Cloudflare Images MP4 stitching.
  - 90-110s: R2 upload & 1-click publish ping via Telegram `@Sophia_Bbot`.

---

## 3. Pillar 3: Comment-to-DM Trigger Router & Conversational Closer
- **Intent Matching:** RegEx tokenizer normalizing Vietnamese intent keywords (`ib`, `inbox`, `link`, `giá`, `deal`, `tư vấn`).
- **4-Stage Conversational FSM:**
  - `GREETING_QUALIFY`: Acknowledge product inquiry, assess budget/needs.
  - `OBJECTION_HANDLING`: Mitigate skepticism, handle price resistance.
  - `LINK_DISPATCH`: Emit personalized affiliate shortlink with `sub_id` tracking.
  - `FOLLOWUP_NUDGE`: 24-hr delayed Inngest reminder with scarcity coupon.
- **Attribution Ledger:** Cloudflare D1 tables `dm_leads` & `dm_conversion_ledger` tracking full conversion lineage from comment origin to affiliate postback settlement with Web Crypto HMAC verification.

---

## 4. Architectural Boundaries & Data Flow

```
[Webhooks / Crons]
       |
       v
+------------------+     +--------------------+     +---------------------+
| CF Stream Ingest |     | Google Trends RSS  |     | TikTok/IG Comments  |
+------------------+     +--------------------+     +---------------------+
       |                            |                          |
       v                            v                          v
[Live Q&A Engine]       [Semantic Matcher]         [Comment Router]
(tree/live-stream)       (tree/newsjacking)          (tree/dm-funnel)
       |                            |                          |
       +----------------------------+--------------------------+
                                    |
                                    v
                     [Inngest Background Jobs]
                      (forest/inngest/functions)
                                    |
       +----------------------------+--------------------------+
       |                            |                          |
       v                            v                          v
[Cloudflare Stream / WHIP]    [R2 / Video Delivery]    [D1 Attribution Ledger]
```

---

## 5. Security, BYOK & Quality Invariants
- **BYOK:** Customer supplies OpenRouter, ElevenLabs, Fal.ai API keys via Setup Wizard.
- **Zero Operator Infra:** Edge-native on Cloudflare Workers (128MB RAM compliance).
- **Quality Gates:** 0 `:any`, 0 `console.log`, <200 LOC per file, 100% green tests.
