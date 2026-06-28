# Open-Source AI Video Generation OSS Research
**Date:** 2026-04-29 | **Researcher:** AI Agent | **Project:** Sophia Video SaaS Pipeline

---

## EXECUTIVE SUMMARY

Ranked 7 open-source projects for affiliate video generation SaaS. **Top 5 to compose pipeline:**
1. **Remotion** (React → serverless video) — render layer
2. **HunyuanVideo 1.5** (T2V foundation) — core generation
3. **MoviePy** (Python composition) — fallback render
4. **Coqui TTS** (voice synthesis) — audio layer
5. **MoneyPrinterTurbo** (full orchestration template) — reference pipeline

**Target Stack:** Next.js (UI) + Cloudflare Workers (orchestration) + Supabase (state) + Local Qwen 3 32B (prompt routing) + OSS models (generation).

---

## PROJECT DEEP DIVES

### 1. HARRY0703/MONEYPRINTERTURBO
**License:** MIT ✅ (commercial OK)  
**Stars:** 56.6k | **Active:** Yes (10 releases)  
**Language:** Python (98%)

**Core Feature:** End-to-end short-video pipeline: topic → script (LLM) → TTS → stock footage sourcing → subtitle generation → FFmpeg render. Handles 9:16 portrait (TikTok/Shorts) + 16:9 landscape. Batch processing + Web UI.

**Stack Compat:**
- Dockerizable (has Dockerfile)
- Requires Python 3.9+, FFmpeg, ImageMagick
- MoviePy + OpenAI/DeepSeek LLM integrations
- Does NOT scale serverless (local render bottleneck)

**Cost Model:**
- GPU optional but beneficial (4-8 core CPU minimum)
- LLM calls: ~$0.01-0.10 per video (depends on script length)
- Zero infra cost if self-hosted

**Verdict: KEEP** — Reference implementation for orchestration logic. Extract script generation patterns, TTS integration, subtitle logic. Render via Remotion/MoviePy instead of local FFmpeg.

---

### 2. RAYVENTURA/SHORTGPT
**License:** MIT ✅ (commercial OK)  
**Stars:** 7.3k | **Active:** Yes (v0.3.0 Feb 2025 with Gemini support)  
**Language:** Python (99.7%)

**Core Feature:** Autonomous short-form content creation using LLM-oriented DSL (proprietary video editing language). Voiceover synthesis (ElevenLabs, EdgeTTS, 30+ languages), caption generation, Pexels/Bing Image Search asset sourcing. TinyDB persistence.

**Stack Compat:**
- Runs in Google Colab (no install)
- Docker + Gradio web UI (localhost:31415)
- MoviePy backend for composition
- Python-only; Nodejs bindings needed for Next.js integration

**Cost Model:**
- Free if using EdgeTTS (lower quality)
- ElevenLabs voice: $15-100/mo per API
- Pexels free tier: limited requests

**Verdict: KEEP** — DSL approach interesting for prompt templates. Caption generation solid. Audio synthesis library well-curated. Integrate via Docker sidecar + API boundary.

---

### 3. WAN-VIDEO/WAN2.2
**License:** Apache 2.0 ✅ (commercial OK)  
**Latest:** 2026 active development  
**Stack:** Python + PyTorch 2.4+

**Core Feature:** Text-to-video (T2V) + Image-to-video (I2V) + Speech-to-video (S2V) + character animation. Mixture-of-Experts diffusion (27B params, two expert paths: high-noise early stage + low-noise refinement). Native 720P support via 4×16×16 compression. 480P/720P output.

**Stack Compat:**
- Runs on consumer GPUs (24GB VRAM for 5B model, 80GB for 14B)
- PyTorch inference (quantization-friendly)
- Python-only; needs Docker wrapper for serverless
- Not real-time (generation ~seconds per frame)

**Cost Model:**
- GPU renting: $0.30-1.00/min on GPU cloud (Lambda Labs, Runpod)
- For 30-60sec video: ~$5-15 compute cost (4-8 min generation)
- Batch friendly (amortize setup costs)

**Verdict: KEEP** — Best cinematic quality for small-batch affiliate videos. Mixture-of-Experts = efficient scaling. Trade-off: generation time (minutes/video) OK for batch mode. Deploy via Cloudflare Workers → GPU runner (Runpod/Lambda) → callback to Supabase.

---

### 4. REMOTION-DEV/REMOTION
**License:** Proprietary (requires company license for commercial use ⚠️ — verify terms)  
**Stars:** 45.2k | **Active:** Yes (strong community)  
**Language:** TypeScript (74.2%)

**Core Feature:** React-based programmatic video rendering. Build video as React components (reusable, composable). CSS/Canvas/SVG/WebGL effects. Serverless deployment (AWS Lambda, Render, Cloudflare Workers). Fast Refresh dev loop.

**Stack Compat:**
- Native TypeScript/Node.js ✅ (perfect for SaaS)
- Serverless-first architecture (AWS Lambda workers)
- React ecosystem (Tailwind, shadcn compatible)
- Real-time preview + programmatic export

**Cost Model:**
- Free tier: <$100/mo compute
- Paid: company licensing (custom terms)
- Serverless execution: ~$0.20-0.50 per video render (5-30min runtime)

**Verdict: KEEP with CAUTION** — Best developer experience for TS/Node.js team. Verify commercial license terms before production. Perfect for affiliate template rendering (dynamic text overlays, branding). Use for composition layer (script text + visuals → final video).

---

### 5. ZULKO/MOVIEPY
**License:** MIT ✅ (commercial OK)  
**Latest:** v2.2.1 (May 2025)  
**Language:** Python (primary)

**Core Feature:** Python video composition library. Reads/writes all common formats (MP4, GIF, WebM). Numpy-based pixel manipulation. Effects DSL (cuts, concatenations, filters, transitions). Dependency: FFmpeg.

**Stack Compat:**
- Pure Python (numpy arrays)
- Plugs into any Python pipeline
- Slow for large batches (not GPU-accelerated)
- Breaking changes in v2.0 (legacy v1 not recommended)

**Cost Model:**
- Free (MIT)
- CPU-only (slow, but cost-effective)
- ~2-5min per 60sec video on modern CPU

**Verdict: KEEP as FALLBACK** — Reliable, proven library for simple composition (concat clips, add text, apply filters). Use if Remotion license unclear. Slower than Remotion but cheaper.

---

### 6. COQUI-AI/TTS
**License:** MPL-2.0 (Mozilla Public License) ✅ (commercial OK)  
**Stars:** 45.2k | **Active:** Yes (4,668 commits)  
**Language:** Python + PyTorch

**Core Feature:** Text-to-speech with voice cloning (XTTS v2: 16 languages, speaker cloning; YourTTS: EN/FR/PT). 1,100+ pretrained models (Tacotron, Glow-TTS, FastSpeech2, VITS, XTTS, Bark vocoders). Docker support (CPU/GPU).

**Stack Compat:**
- Python API + CLI + Docker
- Lightweight (models 50-200MB each)
- Real-time TTS (~1 sec for 10-word sentence on GPU)
- Can run as local Ollama-style service

**Cost Model:**
- Free (MPL-2.0)
- Self-hosted: CPU OK for affiliate use
- OR: Coqui API (commercial tier) ~$0.01/sec audio

**Verdict: KEEP** — Superior to Bark/ElevenLabs for affiliate budget. Voice cloning (XTTS) key for brand personalization. Deploy as Docker microservice in Cloudflare Workers ecosystem.

---

### 7. SUNO-AI/BARK
**License:** MIT ✅ (commercial OK as of May 2023)  
**Status:** Mature (generative TTS, ~real-time)  
**Language:** Python + PyTorch

**Core Feature:** Transformer-based text-to-audio (speech + music + sound effects). 100+ speaker presets (13+ languages). 8-12GB VRAM. High-variance outputs (creative liberties).

**Stack Compat:**
- Python/PyTorch only
- Requires GPU (12GB minimum)
- Slower than Coqui on CPU
- No voice cloning (presets only)

**Cost Model:**
- Free
- High variance = less predictable (risky for affiliate brand consistency)

**Verdict: SKIP** — Bark outputs unpredictable (high variance). Better alternatives exist. Coqui XTTS superior for affiliate use (controllable voice cloning).

---

## 2026 ECOSYSTEM: NEWER MODELS

### HUNYUANVIDEO 1.5 (Tencent)
**License:** Apache 2.0 ✅ (commercial OK, but 100M MAU limit)  
**Latest:** Nov 2025 (v1.5, 8.3B params, FP8 quantization, multi-GPU xDiT)

**Why It Wins:**
- Fastest open-source T2V (30fps at 1216×704 on capable GPU)
- FP8 quantization = cheaper GPU rental
- Multi-GPU parallel inference (xDiT framework)
- Avatar + custom models (fine-tuning friendly)

**Verdict: PREFERRED over Wan2.2 for SaaS** — Balanced speed/quality. 100M MAU clause not issue for MVP. Use HunyuanVideo 1.5 as primary T2V engine.

---

### COGVIDEOX-5B
**Verdict: SKIP** — 6-second clips too short for affiliate videos (need 15-60sec). Lighter than HunyuanVideo but insufficient.

---

### LTX-VIDEO (Lightricks)
**Verdict: KEEP** — Faster than HunyuanVideo. Less mature ecosystem. Monitor for 2026 adoption.

---

### MOCHI 1
**License:** Apache 2.0 ✅ (commercial OK)  
**Verdict: KEEP** — Clear licensing. Asymmetric Diffusion Transformer. Less cinematic than HunyuanVideo. Good backup.

---

### STABLE VIDEO DIFFUSION (Stability AI)
**License:** Community License (free <$1M revenue, paid enterprise >$1M)  
**Verdict: SKIP** — Only image-to-video (I2V), not text-to-video. Licensing complexity. HunyuanVideo superior.

---

## COMPOSITION: TOP 5 PIPELINE

```
INPUT: Affiliate Product (name, price, features)
       ↓
1. SCRIPT GENERATION
   Tool: Qwen 3 32B local (localhost:11434)
   Output: 30-60sec script, voiceover timing

2. TTS/VOICE SYNTHESIS
   Tool: Coqui TTS (XTTS v2, Docker microservice)
   Input: Script
   Output: WAV audio file + timeline
   Cost: $0 (self-hosted)

3. VISUAL GENERATION (two paths)
   Path A (cinematic 60sec):
     Tool: HunyuanVideo 1.5 (GPU runner: Runpod/Lambda)
     Input: Script → visual prompts
     Output: MP4 video (720P)
     Cost: $5-15/video
   
   Path B (quick/templates 15sec):
     Tool: Remotion (Next.js/Cloudflare Workers)
     Input: Static assets + text overlays
     Output: MP4 video
     Cost: $0.20-0.50/video

4. COMPOSITION/EDITING
   Tool: MoviePy (Python, fallback) OR Remotion (preferred TS)
   Input: HunyuanVideo MP4 + Coqui audio + subtitles
   Output: Final MP4 (with branding, captions)
   Cost: $0.10-0.50/video (MoviePy CPU) OR $0.20-0.50 (Remotion serverless)

5. PUBLISH/STORAGE
   Tool: Supabase (storage bucket) + CDN
   Output: Shareable URL
   Cost: $0.01-0.05 per video (egress)

TOTAL COST PER VIDEO: $5.50-16.55 (cinematic) OR $0.35-1.00 (template-based)
```

---

## RECOMMENDED ARCHITECTURE

```yaml
# Next.js SaaS Frontend
# ↓ (webhook)
# Cloudflare Workers (orchestration engine)
#   - Poll local Qwen 3 for script generation
#   - Queue video job to GPU runner (Runpod/Lambda)
#   - Call Coqui Docker microservice for TTS
#   - Compose via Remotion serverless OR MoviePy Lambda
#   - Store result in Supabase bucket
#
# Local Services (M1 MacBook)
#   - Qwen 3 32B @ localhost:11434 (ollama)
#   - Coqui TTS @ localhost:8000 (Docker)
#
# Cloud Services
#   - GPU Runner: Runpod / Lambda (HunyuanVideo 1.5)
#   - Video Composition: Remotion on Cloudflare Workers
#   - State: Supabase PostgreSQL
#   - Storage: Supabase/Cloudflare R2
```

---

## UNRESOLVED QUESTIONS

1. **Remotion commercial license terms** — need explicit clearance from legal. Is SaaS resale of videos allowed, or company-license-only?
2. **HunyuanVideo 100M MAU clause** — at what point does "monthly active users" trigger license renegotiation? Affiliate SaaS customers ≠ our MAU?
3. **Coqui XTTS voice cloning at scale** — tested cloning with <10 samples? Quality for affiliate brand consistency?
4. **Cloudflare Workers + GPU runner latency** — acceptable for affiliate video generation (expect 5-15min turnaround)?

---

## SOURCES
- [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo)
- [ShortGPT](https://github.com/RayVentura/ShortGPT)
- [Wan2.2](https://github.com/Wan-Video/Wan2.2)
- [Remotion](https://github.com/remotion-dev/remotion)
- [MoviePy](https://github.com/Zulko/moviepy)
- [Coqui TTS](https://github.com/coqui-ai/TTS)
- [Bark](https://github.com/suno-ai/bark)
- [HunyuanVideo](https://github.com/Tencent-Hunyuan/HunyuanVideo)
- [Pixazo OSS Video Models 2026](https://www.pixazo.ai/blog/best-open-source-ai-video-generation-models)
- [KDnuggets Top 5 Models](https://www.kdnuggets.com/top-5-open-source-video-generation-models)
- [AiFreeForever 31 Models](https://aifreeforever.com/blog/open-source-ai-video-models-free-tools-to-make-videos)
- [SiliconFlow Ultimate Guide](https://www.siliconflow.com/articles/en/best-open-source-models-for-video-to-text-transcription)
- [Stability AI License](https://stability.ai/license)
- [Vercel AI Gateway Video Generation](https://vercel.com/docs/ai-gateway/capabilities/video-generation)
- [Creatomate Video API](https://creatomate.com/)
- [FFAIVideo Node.js](https://github.com/drawcall/FFAIVideo)
