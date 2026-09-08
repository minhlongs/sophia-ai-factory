# PROVIDER CAPABILITY TRUTH REPORT

**Date:** 2026-09-01
**Scope:** Official public image-generation APIs only. No bridges, no OAuth logins, no unofficial endpoints.
**Method:** Official docs via WebFetch + WebSearch. No adapters written, no credentials used.

---

## PHASE 1 — PROVIDER CANDIDATES

### 1. Google Imagen 4 (Gemini API / Vertex AI)
- **Official API:** YES — documented at https://ai.google.dev/gemini-api/docs/imagen and https://cloud.google.com/vertex-ai/generative-ai/docs/image/overview
- **Owner:** Google DeepMind / Google Cloud
- **Base URL (Gemini API):** `https://generativelanguage.googleapis.com/v1beta`
- **Base URL (Vertex AI):** `https://{LOCATION}-aiplatform.googleapis.com/v1`
- **CRITICAL DEPRECATION NOTICE:** Imagen 4 models are **deprecated and will shut down on August 17, 2026**. Google recommends migrating to **Gemini 2.5 Flash Image** (`gemini-2.5-flash-image`, branded "Nano Banana"). This is a live deprecation — any integration built on Imagen 4 has a hard deadline.
- **Migration target:** `gemini-2.5-flash-image` via `client.models.generate_content()` (NOT `generate_images()`).

### 2. fal.ai
- **Official API:** YES — documented at https://fal.ai/docs
- **Owner:** fal.ai (private company, US-based)
- **Base URL:** `https://queue.fal.run/`
- **Status:** Active, no deprecation noted.

### 3. Replicate
- **Official API:** YES — documented at https://replicate.com/docs/reference/http
- **Owner:** Replicate, Inc.
- **Base URL:** `https://api.replicate.com/v1`
- **Status:** Active, no deprecation noted.

### 4. Cloudflare Workers AI
- **Official API:** YES — documented at https://developers.cloudflare.com/workers-ai/
- **Owner:** Cloudflare, Inc.
- **Base URL:** `https://api.cloudflare.com/client/v4`
- **Status:** Active, no deprecation noted.

### 5. Stability AI
- **Official API:** YES — documented at https://platform.stability.ai/docs/api-reference
- **Owner:** Stability AI Ltd.
- **Base URL:** `https://api.stability.ai/v2beta`
- **Status:** Active, but the company has faced financial/leadership challenges (documented in public news). API itself is live.

### 6. OpenAI (GPT-Image / DALL-E 3)
- **Official API:** YES — documented at https://developers.openai.com/api/docs/api-reference/images
- **Owner:** OpenAI, L.L.C.
- **Base URL:** `https://api.openai.com/v1`
- **Status:** Active. DALL-E 3 still supported; GPT-Image-1/2 are the newer models.

---

## PHASE 2 — CAPABILITY TRUTH

### 2.1 Google Imagen 4

| Field | Value |
|---|---|
| **Official API** | YES (but deprecated, shutdown 2026-08-17) |
| **Image generation** | YES |
| **Endpoint (Gemini API)** | `POST /v1beta/models/imagen-4.0-generate-001:predict` |
| **Endpoint (Vertex AI)** | `POST /v1/projects/{PROJECT}/locations/{LOCATION}/publishers/google/models/{MODEL}:predict` |
| **Auth** | API key via `x-goog-api-key` header (Gemini API) OR OAuth 2.0 Bearer token via `Authorization: Bearer` (Vertex AI, from `gcloud auth print-access-token`) |
| **Request schema** | `{"instances":[{"prompt":"..."}], "parameters":{"sampleCount":1-4, "aspectRatio":"1:1|3:4|4:3|9:16|16:9", "imageSize":"1K|2K", "personGeneration":"dont_allow|allow_adult|allow_all"}}` |
| **Response schema** | `{"generatedImages":[{"image":{"imageBytes":"<base64>","mimeType":"image/png"}}]}` |
| **Output format** | Base64-encoded PNG (SynthID watermark embedded) |
| **Rate limits** | NOT DOCUMENTED on the Imagen page. Vertex AI default quota ~20 QPM per project per region (per pricing page). Rate-limit page says "Images per minute (IPM) is only calculated for models capable of generating images" but does not enumerate Imagen-specific IPM. |
| **Timeout model** | Synchronous — single POST returns images directly. No async/job workflow documented. |
| **Retry semantics** | NOT DOCUMENTED for Imagen specifically. |
| **Webhooks** | NO — synchronous only. |
| **Cost** | **Gemini API pricing page does NOT list Imagen 4 pricing.** Vertex AI pricing page lists: `imagen-4.0-generate` $0.04/image, `imagen-4.0-ultra-generate` $0.06/image, `imagen-4.0-fast-generate` $0.01/image. **However, the Gemini API pricing page returns "Not available" for all Imagen models.** The two Google surfaces disagree. |
| **Free tier** | NO dedicated free tier for Imagen. $300 new-account GCP credit applies. |

**Key risk:** Imagen 4 is deprecated with a hard shutdown date. Building on it requires a forced migration by August 2026. The replacement is `gemini-2.5-flash-image` (Nano Banana), which uses a completely different API shape (`generate_content` with image response parts, not `generate_images`).

---

### 2.2 fal.ai

| Field | Value |
|---|---|
| **Official API** | YES |
| **Image generation** | YES |
| **Endpoint** | `POST https://queue.fal.run/{model-id}` (e.g., `/fal-ai/flux/schnell`, `/fal-ai/flux/dev`) |
| **Auth** | API key via `Authorization: Key $FAL_KEY` header. Keys at `fal.ai/dashboard/keys`. |
| **Request schema** | JSON body, model-specific. For FLUX: `{"prompt":"...", "image_size":"...", "num_inference_steps":4, "num_images":1, "seed":0, "enable_safety_checker":true, "output_format":"png"}` |
| **Response schema** | `{"images":[{"url":"https://...", "width":1024, "height":768, "content_type":"image/jpeg"}], "timings":{"inference":0.76}, "seed":0, "has_nsfw_concepts":[false], "prompt":"..."}` |
| **Output format** | URL (CDN-hosted image) |
| **Rate limits** | NOT DOCUMENTED in official docs. |
| **Timeout model** | Sync + async queue + streaming + WebSocket (model-dependent). |
| **Retry semantics** | NOT DOCUMENTED. |
| **Webhooks** | NOT DOCUMENTED in official docs. |
| **Cost** | FLUX Schnell: $0.003/megapixel (rounded up). FLUX 1.1 Pro: $0.04/image. FLUX Dev: $0.025/image. Seedream V4: $0.03/image. |
| **Free tier** | NOT DOCUMENTED. |

**Key notes:** Output is a URL, not base64 — simpler to handle. Billing is per-megapixel or per-image. The `timings.inference` field gives measured latency in the response. SDK available for Python (`fal_client`) and JS (`@fal-ai/client`).

---

### 2.3 Replicate

| Field | Value |
|---|---|
| **Official API** | YES |
| **Image generation** | YES |
| **Endpoint** | `POST https://api.replicate.com/v1/predictions` (community models) OR `POST /v1/models/{owner}/{name}/predictions` (official models) OR `POST /v1/deployments/{owner}/{name}/predictions` (deployments) |
| **Auth** | API token via `Authorization: Bearer <token>` header. Tokens at `replicate.com/account/api-tokens`. |
| **Request schema** | `{"version":"<version_id>", "input":{...model-specific...}, "webhook":"https://...", "webhook_events_filter":["start","output","logs","completed"], "stream":false}` |
| **Response schema** | `{"id":"...", "model":"...", "version":"...", "input":{...}, "output":{...}|"url", "logs":"...", "error":null, "status":"starting|processing|succeeded|failed|canceled", "created_at":"...", "started_at":"...", "completed_at":"...", "metrics":{"predict_time":1.2,"total_time":3.4}, "urls":{"get":"...","cancel":"...","stream":"..."}, "data_removed":false}` |
| **Output format** | URL (HTTPS, from `replicate.delivery`) for file outputs. JSON objects for non-file outputs. |
| **Rate limits** | **DOCUMENTED:** Create prediction: 600 requests/minute. All other endpoints: 3000 requests/minute. Returns HTTP 429 with "Request was throttled. Expected available in 1 second." |
| **Timeout model** | Async by default (returns immediately with `starting` status). Sync mode via `Prefer: wait=N` header (N=1–60 seconds). Cancel-After header for auto-cancel (5s–24h). |
| **Retry semantics** | NOT DOCUMENTED explicitly. Webhooks retried on network failures (must be idempotent). |
| **Webhooks** | YES — documented. HTTPS URL, POST with same body as `predictions.get` response. Events: `start`, `output`, `logs`, `completed`. Verify via signing secret from `GET /webhooks/default/secret`. |
| **Cost** | FLUX 1.1 Pro: $0.04/image. FLUX Dev: $0.025/image. FLUX Schnell: $0.003/image ($3.00 per thousand). Billed by output for FLUX; other models billed by GPU-second. |
| **Free tier** | NO. |

**Key notes:** The most well-documented API of all candidates. Webhooks are first-class. Output URLs auto-expire (data removed after 1 hour by default). The `metrics.predict_time` field gives measured inference time. SDK available but has limited Cloudflare Workers compatibility — raw REST API recommended for edge.

---

### 2.4 Cloudflare Workers AI

| Field | Value |
|---|---|
| **Official API** | YES |
| **Image generation** | YES |
| **Endpoint** | `POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/{MODEL}` |
| **Auth** | Bearer token via `Authorization: Bearer {API_TOKEN}`. Account ID embedded in URL path. Token needs "Workers AI - Read" + "Workers AI - Edit" permissions. |
| **Request schema** | JSON body, model-specific. For FLUX-1-schnell: `{"prompt":"...", "steps":4 (max 8)}` |
| **Response schema** | `{"result":{"image":"<base64-jpeg>"}, "success":true, "errors":[], "messages":[]}` |
| **Output format** | Base64-encoded JPEG (for FLUX models). Binary ArrayBuffer for others. |
| **Rate limits** | **DOCUMENTED:** Text-to-Image: 720 requests/minute (except `@cf/runwayml/stable-diffusion-v1-5-img2img` at 1500). Frontier model limits: 20 RPM (standard billing) or 50 RPM (Unified billing). |
| **Timeout model** | Synchronous — single POST returns result. |
| **Retry semantics** | NOT DOCUMENTED. |
| **Webhooks** | NO — synchronous only. |
| **Cost** | **Neuron-based:** $0.011 per 1,000 Neurons. FLUX-1-schnell: 4.80 neurons per 512×512 tile + 9.60 neurons per step. FLUX-2-dev: 18.75 neurons per input tile per step + 37.50 neurons per output tile per step. **Free allocation: 10,000 Neurons/day** (resets 00:00 UTC). |
| **Free tier** | YES — 10,000 Neurons/day free. |

**Key notes:** Native Cloudflare Workers integration via `env.AI` binding. GPU-backed inference on Cloudflare's edge. Output is base64 JPEG — must decode. Pricing is per-tile-per-step, not per-image, which makes cost estimation harder. The `image` field in response is a base64 string.

---

### 2.5 Stability AI

| Field | Value |
|---|---|
| **Official API** | YES |
| **Image generation** | YES |
| **Endpoint** | `POST https://api.stability.ai/v2beta/stable-image/generate/sd3` (also `/core`, `/ultra`, `/creative`) |
| **Auth** | API key via `Authorization: Bearer {API_KEY}` header. Keys at `platform.stability.ai/account/keys`. |
| **Request schema** | Multipart form-data: `prompt` (string), `model` (e.g., `sd3.5-large`), `output_format` (png/jpeg/webp), `aspect_ratio` (e.g., `16:9`). |
| **Response schema** | Binary image data (when `Accept: image/*`) OR JSON with base64 (when `Accept: application/json`). |
| **Output format** | Binary OR Base64 (client chooses via `Accept` header). |
| **Rate limits** | NOT DOCUMENTED in official docs. Community reports: Free ~3-10 RPM, Creator ~20-50 RPM, Enterprise custom. |
| **Timeout model** | Synchronous. |
| **Retry semantics** | NOT DOCUMENTED. |
| **Webhooks** | NO. |
| **Cost** | **Credit-based.** 1 credit ≈ $0.01 USD (approximate, varies by plan). SD3.5 Large: ~6.5 credits. SD3.5 Medium: ~3.5 credits. SDXL 1.0: ~1 credit. Stable Image Core: ~3 credits. Stable Image Ultra: ~8 credits. Starter: ~$10/month (~1,000 credits). |
| **Free tier** | YES — 25 free credits on signup. |

**Key notes:** The official docs page at `platform.stability.ai/docs/api-reference` returns only a title — the actual API reference content was not fetchable. The above is reconstructed from the redirect target and community documentation. **This is the least verifiable of the candidates from official docs alone.** Multipart form-data input (not JSON) makes it structurally different from all other candidates.

---

### 2.6 OpenAI (GPT-Image / DALL-E 3)

| Field | Value |
|---|---|
| **Official API** | YES |
| **Image generation** | YES |
| **Endpoint** | `POST https://api.openai.com/v1/images/generations` (also `/images/edits`, `/images/variations`) |
| **Auth** | API key via `Authorization: Bearer YOUR_API_KEY` header. |
| **Request schema** | `{"prompt":"...", "model":"gpt-image-2|gpt-image-1|dall-e-3|dall-e-2", "n":1-10, "quality":"auto|high|medium|low|hd|standard", "size":"1024x1024|...", "response_format":"url|b64_json", "output_format":"png|jpeg|webp", "background":"transparent|opaque|auto", "moderation":"low|auto", "style":"vivid|natural", "partial_images":0-3, "stream":false}` |
| **Response schema** | `{"created":1234567890, "background":"transparent|opaque", "data":[{"b64_json":"...", "url":"...", "revised_prompt":"..."}], "output_format":"png|webp|jpeg", "quality":"low|medium|high", "size":"1024x1024|...", "usage":{"input_tokens":100, "output_tokens":200, "total_tokens":300}}` |
| **Output format** | Base64 (GPT models always) OR URL (DALL-E 2/3, default, URLs valid 60 minutes only). |
| **Rate limits** | NOT DOCUMENTED on the images page. Rate-limit page mentions "IPM (images per minute) for some streaming audio models" but does not enumerate image IPM. |
| **Timeout model** | Synchronous. GPT models support streaming via `stream: true` and `partial_images`. |
| **Retry semantics** | NOT DOCUMENTED. |
| **Webhooks** | NO. |
| **Cost** | DALL-E 3 Standard 1024×1024: $0.040/image. DALL-E 3 HD 1024×1024: $0.080/image. DALL-E 3 HD 1024×1792: $0.120/image. GPT-Image-1: token-based — input $10/1M tokens, output image tokens $40/1M tokens. Approximate: Low quality 1024×1024 ~$0.02, Medium ~$0.07, High ~$0.16+. |
| **Free tier** | NO. |

**Key notes:** DALL-E 3 URLs expire in 60 minutes — must download or re-request with `b64_json`. GPT-Image models are the newer generation with better text rendering and world knowledge. The `usage` field gives token breakdown. The API reference at `developers.openai.com/api/docs/api-reference/images` is the authoritative source.

---

## PHASE 5 — QUALITY / LATENCY / RELIABILITY

### Scoring methodology
- **Quality:** Based on documented benchmarks, model architecture, and public evaluations. NOT self-tested.
- **Latency:** Based on documented claims or measured data in official docs.
- **Reliability:** Based on documented SLA, uptime history, and company stability.
- **Operational complexity:** Based on auth difficulty, sync/async handling, webhook needs, and output format handling.

### 5.1 Google Imagen 4

| Dimension | Score | Evidence |
|---|---|---|
| **Quality** | HIGH | Imagen 3 was benchmarked above DALL-E 3 and SD3 on DrawBench/FID. Imagen 4 is iterative improvement. No independent Imagen 4 benchmark found in official docs. |
| **Latency** | MEDIUM | Synchronous, no documented latency numbers. Vertex AI adds network hop. |
| **Reliability** | LOW (deprecation risk) | **Hard shutdown 2026-08-17.** This is the dominant reliability concern. |
| **Operational complexity** | MEDIUM | Simple sync API, base64 output. But two different Google surfaces (Gemini API vs Vertex AI) with different auth and pricing. |

### 5.2 fal.ai

| Dimension | Score | Evidence |
|---|---|---|
| **Quality** | HIGH | Hosts FLUX.1 (Black Forest Labs, founded by ex-SD creators), Seedream V4, Nanobanana. FLUX.1 is competitive with Midjourney v6 and DALL-E 3 in community benchmarks. |
| **Latency** | HIGH | FLUX Schnell: ~0.76s inference time (measured in official docs response example). Sub-second claimed. |
| **Reliability** | MEDIUM | No documented SLA. Company is private, no public uptime history. |
| **Operational complexity** | LOW | Simple JSON-in, URL-out. API key auth. No async handling required for sync models. |

### 5.3 Replicate

| Dimension | Score | Evidence |
|---|---|---|
| **Quality** | HIGH | Hosts FLUX, SD3, and many community models. Quality is model-dependent, not platform-dependent. |
| **Latency** | MEDIUM | Async by default. Sync mode limited to 60s. `metrics.predict_time` gives actual inference time. FLUX Schnell ~1-3s, FLUX Dev/Pro ~5-15s. |
| **Reliability** | MEDIUM-HIGH | Well-documented API, webhook verification, idempotency guidance. No public SLA found. |
| **Operational complexity** | MEDIUM-HIGH | Async-by-default requires polling or webhook setup. Webhook signing secret verification adds complexity. Output URLs expire in 1 hour. |

### 5.4 Cloudflare Workers AI

| Dimension | Score | Evidence |
|---|---|---|
| **Quality** | MEDIUM | Hosts FLUX-1-schnell, FLUX-2-dev, SDXL, Dreamshaper. Quality is model-dependent. FLUX-2 is newer/better than FLUX-1. |
| **Latency** | HIGH | Edge inference, GPU-backed. No documented latency numbers, but edge deployment implies low network latency. |
| **Reliability** | HIGH | Cloudflare infrastructure, documented rate limits, free tier available. |
| **Operational complexity** | LOW (for Cloudflare Workers) | Native `env.AI` binding. Simple JSON-in, base64-out. Account ID in URL. |

### 5.5 Stability AI

| Dimension | Score | Evidence |
|---|---|---|
| **Quality** | MEDIUM-HIGH | SD3.5 is competitive. SDXL is older but solid. Company has faced financial/leadership challenges that may affect model iteration. |
| **Latency** | MEDIUM | Synchronous, no documented latency numbers. Community reports ~3-7s for SD3.5. |
| **Reliability** | LOW-MEDIUM | Company financial instability documented in public news. API is live but future uncertain. |
| **Operational complexity** | MEDIUM | Multipart form-data (not JSON) is unusual. Credit-based pricing requires balance management. |

### 5.6 OpenAI GPT-Image / DALL-E 3

| Dimension | Score | Evidence |
|---|---|---|
| **Quality** | HIGH | GPT-Image-1 ranked among top models in early 2025 community evaluations. Better text rendering and instruction following than DALL-E 3. |
| **Latency** | MEDIUM | Synchronous. Streaming partial images available for GPT models. No documented latency numbers. |
| **Reliability** | HIGH | OpenAI infrastructure, enterprise-grade. |
| **Operational complexity** | LOW | Simple JSON-in, base64-or-URL-out. API key auth. DALL-E 3 URLs expire in 60 minutes (must handle). |

---

## PHASE 1+2+5 VERDICT

| Provider | Official API | Endpoint | Auth | Output Format | Cost | CF Workers Compatible? | Classification |
|---|---|---|---|---|---|---|---|
| **Google Imagen 4** | YES (deprecated 2026-08-17) | `generativelanguage.googleapis.com/v1beta/models/{model}:predict` | `x-goog-api-key` header | Base64 PNG | $0.01–$0.06/image (Vertex AI); NOT LISTED on Gemini API | YES (via fetch) | **DEPRECATED — do not build on this** |
| **fal.ai** | YES | `queue.fal.run/{model-id}` | `Authorization: Key $FAL_KEY` | URL (CDN) | $0.003–$0.04/image | YES (via fetch, SDK uses standard fetch) | **RECOMMENDED — best latency, simple API** |
| **Replicate** | YES | `api.replicate.com/v1/predictions` | `Authorization: Bearer <token>` | URL (replicate.delivery) | $0.003–$0.04/image | PARTIAL (SDK has Node.js deps; use raw REST) | **RECOMMENDED — best documentation, webhooks** |
| **Cloudflare Workers AI** | YES | `api.cloudflare.com/client/v4/accounts/{id}/ai/run/{model}` | `Authorization: Bearer {token}` | Base64 JPEG | $0.011/1000 Neurons; 10k free/day | **NATIVE** | **RECOMMENDED — native edge, free tier** |
| **Stability AI** | YES | `api.stability.ai/v2beta/stable-image/generate/{model}` | `Authorization: Bearer {key}` | Binary or Base64 | Credit-based (~$0.01/credit) | YES (via fetch) | **CONDITIONAL — verify company stability** |
| **OpenAI GPT-Image** | YES | `api.openai.com/v1/images/generations` | `Authorization: Bearer {key}` | Base64 (GPT) or URL (DALL-E 3, 60min TTL) | $0.02–$0.19+/image (token-based for GPT) | YES (via fetch) | **RECOMMENDED — highest quality, higher cost** |

---

## KEY FINDINGS

1. **Google Imagen 4 is a trap.** It is deprecated with a hard shutdown date of August 17, 2026. Any integration built on it will break. The migration target (`gemini-2.5-flash-image`) uses a completely different API shape. **Do not select Imagen 4 for new integrations.**

2. **Cloudflare Workers AI is the only native Cloudflare Workers solution.** It runs on Cloudflare's edge GPUs, has a free tier (10k Neurons/day), and integrates via `env.AI` binding. If the project is already on Cloudflare Workers, this is the path of least resistance.

3. **fal.ai has the best latency documentation.** FLUX Schnell measured at ~0.76s inference in official docs. Output is a URL (simpler than base64). Billing is per-megapixel or per-image.

4. **Replicate has the best API documentation.** Webhooks are first-class with signing verification. Rate limits are explicitly documented (600 RPM create, 3000 RPM read). Output URLs expire in 1 hour — must handle.

5. **Stability AI is the least verifiable.** The official API reference page returns only a title — actual content was not fetchable. Multipart form-data input is unusual. Company financial instability is a risk.

6. **OpenAI GPT-Image is the highest quality but highest cost.** Token-based pricing means cost varies by prompt complexity and image detail. DALL-E 3 URLs expire in 60 minutes.

7. **No provider offers a true free production tier.** Cloudflare Workers AI comes closest with 10k Neurons/day free. Stability AI offers 25 signup credits. All others are pay-per-use.

---

## UNRESOLVED QUESTIONS

1. **What is the exact cost of `gemini-2.5-flash-image` (Nano Banana) on the Gemini API?** The pricing page lists it as $0.039/image for up to 1024×1024, but the API shape is completely different from Imagen 4. This is the actual migration target and needs separate investigation.

2. **What are the actual rate limits for fal.ai and Stability AI?** Neither documents rate limits officially. Community reports vary widely.

3. **What is the SLA/uptime history for fal.ai and Replicate?** Neither publishes a public SLA. OpenAI and Google have enterprise SLAs; Cloudflare has infrastructure SLAs.

4. **How does FLUX-2-dev on Cloudflare Workers AI compare to FLUX.1-pro on fal.ai in quality?** Both are Black Forest Labs models, but different generations. No head-to-head benchmark found in official docs.

5. **What is the actual latency of Cloudflare Workers AI image generation?** No documented numbers. Edge deployment implies low network latency, but GPU queue time is unknown.

---

## SOURCES

- https://ai.google.dev/gemini-api/docs/imagen
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://cloud.google.com/vertex-ai/generative-ai/pricing
- https://fal.ai/docs
- https://fal.ai/pricing
- https://fal.ai/models/fal-ai/flux/schnell
- https://replicate.com/docs/reference/http
- https://replicate.com/docs/topics/predictions/create-a-prediction
- https://replicate.com/docs/topics/predictions/rate-limits
- https://replicate.com/pricing
- https://developers.cloudflare.com/workers-ai/
- https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/platform/limits/
- https://platform.stability.ai/docs/api-reference
- https://developers.openai.com/api/docs/api-reference/images
- https://developers.openai.com/api/docs/guides/images-vision
