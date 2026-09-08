# Creative Provider Discovery — Full Report

**Supreme Command #6 — All Phases (0-10)**
**Date:** 2026-09-07
**Role:** Principal Architect + Provider Due Diligence Engineer
**Constraint:** READ-ONLY — No source code changes, no commits, no deploy

---

## Table of Contents

1. [Phase 0 — Repository Truth](#phase-0--repository-truth)
2. [Phase 1 — Provider Candidates](#phase-1--provider-candidates)
3. [Phase 2 — Capability Truth](#phase-2--capability-truth)
4. [Phase 3 — Cloudflare Compatibility](#phase-3--cloudflare-compatibility)
5. [Phase 4 — Economic Model](#phase-4--economic-model)
6. [Phase 5 — Quality / Latency / Reliability](#phase-5--quality--latency--reliability)
7. [Phase 6 — MuAPI Due Diligence](#phase-6--muapi-due-diligence)
8. [Phase 7 — Provider Scorecard](#phase-7--provider-scorecard)
9. [Phase 8 — Certification Classification](#phase-8--certification-classification)
10. [Phase 9 — Recommendation](#phase-9--recommendation)
11. [Phase 10 — Implementation Readiness](#phase-10--implementation-readiness)
12. [Final Verdict](#final-verdict)

---

## Phase 0 — Repository Truth

**Source:** `plans/reports/repo-truth-muapi-due-diligence.md` (debugger agent, source-code verified)

### What MuAPI Capabilities Actually Exist

The MuAPI integration lives in a single REST client:

**File:** `src/tree/clients/muapi-media-client.ts` (187 lines)

- `submitMediaJob({ type, model, prompt, aspectRatio? })` — POST to `https://api.muapi.ai/v1`
- `getJobStatus(jobId)` — poll for completion
- Circuit breaker wrapped via `@/seed/security/circuit-breaker`
- Reads API key from `process.env.MUAPI_API_KEY` (NOT from BYOK resolver)

Supported models (hardcoded):
- **Image:** `midjourney-v7`, `flux-schnell`, `flux-dev`, `hidream`, `flux-kontext`
- **Video:** `kling-3.0`, `seedance-2.0`, `veo3`, `kling-lip-sync`
- **Audio:** `suno-v4`, `mmaudio`

**Conclusion:** Real REST client making real HTTP calls. NOT mocked. Thin "fire-and-poll" — no webhook, no result download.

### Existing Image-Generation Routes

Two real entry points verified from source:

1. **Route A:** `src/app/api/v1/creative-studio/images/generate/route.ts` — POST handler: auth → Zod → tier-gate → `submitMediaJob()` → D1 insert → return `{ jobId }`
2. **Route B:** `src/app/actions/image-generate-action.ts` — Server Action version, identical flow.

Supporting routes: status polling (IDOR-protected), job history (last 50).

**Conclusion:** Sophia has a real, working image-generation route chain. NOT fabricated.

### Existing Provider Integrations

| Provider | Function |
|----------|----------|
| MuAPI | Media generation (image/video/audio) via muapi.ai REST |
| OpenRouter + Anthropic | Text/chat LLM |
| ElevenLabs | TTS |
| NOWPayments | USDT crypto payments |
| Upstash Redis | Session state, caching |
| HeyGen + D-ID | Video avatar BYOK |

**NOT present:** Direct Fal.ai, Replicate, Stability AI, or Claude-Fable adapters. Image generation exclusively via MuAPI.

### Cloudflare Constraints

- **CPU:** 30 seconds per request (standard plan)
- **RAM:** 128 MB
- **Flags:** `nodejs_compat`, `global_fetch_strictly_public`
- **Bindings:** D1 ×2, R2 ×3, KV ×2, IMAGES, AI, WORKER_SELF_REFERENCE

**Implication:** MuAPI async model fits. Sync providers (fal, Stability, Claude-Fable) also fit if response time < 30s.

### Asset Storage

- D1 `media_jobs` for metadata (result_url, thumbnail_url, mime, size, provider, metadata)
- **CRITICAL:** Image results stored as MuAPI CDN URLs — NOT self-hosted R2 objects
- No R2 bucket for generated images

### BYOK Architecture

- `ByokProvider` type includes `muapi` — customers CAN enter MuAPI key via Setup Wizard
- `resolveUserApiKey()` exists — falls back to env if user key not set
- **GAP:** Image routes read `process.env.MUAPI_API_KEY` directly — BYOK stored but NOT consumed

---

## Phase 1 — Provider Candidates

**Source:** `plans/reports/provider-capability-truth.md` (researcher agent, official-docs verified)

Six candidates identified with official APIs:

| # | Provider | Official API | Status |
|---|----------|-------------|--------|
| 1 | Google Imagen 4 | YES (Gemini API + Vertex AI) | **DEPRECATED — shutdown 2026-08-17** |
| 2 | fal.ai | YES | Active |
| 3 | Replicate | YES | Active |
| 4 | Cloudflare Workers AI | YES | Active |
| 5 | Stability AI | YES | Active (company instability documented) |
| 6 | OpenAI (GPT-Image / DALL-E 3) | YES | Active |

**Excluded:** Any unofficial APIs, browser automation, reverse-engineered endpoints.

---

## Phase 2 — Capability Truth

**Source:** `plans/reports/provider-capability-truth.md`

### 2.1 Google Imagen 4

- **Endpoint:** `POST /v1beta/models/imagen-4.0-generate-001:predict` (Gemini API) or Vertex AI equivalent
- **Auth:** API key (`x-goog-api-key`) or OAuth Bearer (Vertex)
- **Output:** Base64 PNG (SynthID watermark)
- **Cost:** $0.01-0.06/image (Vertex). Gemini API pricing returns "Not available".
- **Rate limits:** NOT DOCUMENTED
- **Risk:** Hard shutdown 2026-08-17. Migration to `Gemini API` (different API shape).

### 2.2 fal.ai

- **Endpoint:** `POST https://queue.fal.run/{model-id}`
- **Auth:** `Authorization: Key $FAL_KEY`
- **Output:** URL (CDN-hosted image)
- **Cost:** FLUX Schnell $0.003/megapixel, FLUX Dev $0.025/image, FLUX Pro $0.04/image
- **Rate limits:** NOT DOCUMENTED
- **Webhooks:** NOT DOCUMENTED
- **Key advantage:** URL output — no base64 decode needed

### 2.3 Replicate

- **Endpoint:** `POST https://api.replicate.com/v1/predictions`
- **Auth:** `Authorization: Bearer <token>`
- **Output:** URL (replicate.delivery, **expires 1 hour**)
- **Cost:** FLUX Schnell $0.003, FLUX Dev $0.025, FLUX Pro $0.04 per image
- **Rate limits:** DOCUMENTED — 600 RPM (create), 3000 RPM (other)
- **Webhooks:** YES — first-class with signing secret
- **Key advantage:** Best-documented API. Async-first architecture.

### 2.4 Cloudflare Workers AI

- **Endpoint:** `env.AI` binding (native, no HTTP) or REST `POST /accounts/{id}/ai/run/{model}`
- **Auth:** Bearer token (Account + API Token)
- **Output:** Base64 JPEG
- **Cost:** Neuron-based ($0.011/1000 neurons). FLUX-1-schnell ~$0.0017/image. Free: 10k neurons/day.
- **Rate limits:** DOCUMENTED — 720 RPM text-to-image
- **Key advantage:** Native Workers binding. Zero network latency. Free tier.

### 2.5 Stability AI

- **Endpoint:** `POST https://api.stability.ai/v2beta/stable-image/generate/sd3`
- **Auth:** `Authorization: Bearer {key}`
- **Output:** Binary image or base64
- **Cost:** Credit-based. SD3.5 Large ~$0.065/image, SDXL ~$0.01/image. 25 free credits.
- **Rate limits:** NOT DOCUMENTED
- **Risk:** Company financial/leadership instability documented

### 2.6 OpenAI (GPT-Image / DALL-E 3)

- **Endpoint:** `POST https://api.openai.com/v1/images/generations`
- **Auth:** `Authorization: Bearer {key}`
- **Output:** Base64 (GPT) or URL (DALL-E 3, expires 60 minutes)
- **Cost:** DALL-E 3 Standard $0.04, HD $0.08. GPT-Image token-based ($0.02-0.19).
- **Rate limits:** NOT DOCUMENTED
- **Key risk:** High lock-in. Token-based pricing unpredictable.

---

## Phase 3 — Cloudflare Compatibility

**Source:** `plans/reports/provider-scorecard-certification.md`

| Provider | Classification | Key Factors |
|----------|---------------|-------------|
| Cloudflare Workers AI | **COMPATIBLE** | Native `env.AI` binding. No HTTP. Base64 fits 128MB. |
| fal.ai | **COMPATIBLE** | Standard `fetch`. URL output (no base64 overhead). Sync fits 30s. |
| Replicate | **LIKELY COMPATIBLE** | Raw REST (SDK incompatible). URL expiry requires R2. Async model. |
| Stability AI | **LIKELY COMPATIBLE** | Multipart form-data adds complexity. Binary streaming possible. |
| OpenAI GPT-Image | **COMPATIBLE** | Standard fetch. Base64 decode needed. URL expiry 60min. |
| Google Imagen 4 | **COMPATIBLE** (deprecated) | Standard fetch. Base64 PNG. Shutdown imminent. |
| MuAPI (existing) | **LIKELY COMPATIBLE** | Existing client works. No BYOK. No R2. |

---

## Phase 4 — Economic Model

**Source:** `plans/reports/provider-scorecard-certification.md`

| Provider | Cost/1024² | Free Tier | Markup Potential | Margin Predictability | Lock-in | Classification |
|----------|-----------|-----------|-----------------|----------------------|---------|----------------|
| CF Workers AI | ~$0.0017 | 10k neurons/day | High | Low (per-neuron) | Medium | ACCEPTABLE |
| fal.ai | $0.003-0.04 | None | High | High (per-image) | Low | EXCELLENT |
| Replicate | $0.003-0.04 | None | High | High (FLUX) | Low | EXCELLENT |
| Stability AI | $0.01-0.065 | 25 credits | Moderate | Medium | Medium | ACCEPTABLE |
| OpenAI | $0.02-0.19 | None | Mod-High | Low (GPT) / High (DALL-E) | High | GOOD |
| Google Imagen 4 | $0.01-0.06 | None | Moderate | Medium | High | POOR (deprecated) |
| MuAPI | UNKNOWN | Unknown | Unknown | Unknown | High | UNKNOWN |

---

## Phase 5 — Quality / Latency / Reliability

**Source:** `plans/reports/provider-capability-truth.md`

### Quality Scores (DOCUMENTED only — no runtime testing)

| Provider | Quality | Notes |
|----------|---------|-------|
| OpenAI GPT-Image | Top-tier | Text rendering, world knowledge. Token-based pricing. |
| fal.ai (FLUX.1) | Competitive | Competitive with Midjourney v6. No independent benchmark. |
| Replicate (FLUX) | Same as fal | Same underlying models. Platform-independent. |
| Stability AI (SD3.5) | Good | Competitive. Company stability affects future iteration. |
| CF Workers AI (FLUX-1) | Fast/Lower quality | Schnell is speed-optimized. FLUX-2-dev better. |
| Google Imagen 4 | Good | Benchmarked above DALL-E 3/SD3. Deprecated. |

### Latency Scores

| Provider | Latency | Notes |
|----------|---------|-------|
| fal.ai | ~0.76s | FLUX Schnell inference time documented in response |
| Replicate | 1-15s | Async by default. Sync limited to 60s. |
| CF Workers AI | Unknown | Edge inference, GPU-backed. No documented numbers. |
| Stability AI | ~3-7s | Community reports. Synchronous. |
| OpenAI | Unknown | Synchronous. Streaming available. |

### Reliability Scores

| Provider | Reliability | Notes |
|----------|------------|-------|
| OpenAI | High | Enterprise infrastructure |
| CF Workers AI | High | Cloudflare infrastructure |
| Replicate | Medium | Webhook idempotency guidance. No public SLA. |
| fal.ai | Medium | Private company. No public uptime. No SLA. |
| Stability AI | Low | Company financial/leadership instability |
| MuAPI | Low | Aggregator. No SLA. No public uptime. |

---

## Phase 6 — MuAPI Due Diligence

**Source:** `plans/reports/repo-truth-muapi-due-diligence.md`

| Question | Answer |
|----------|--------|
| What provider powers the route? | MuAPI (muapi.ai) via `submitMediaJob()` — real, NOT mock |
| Image generation or other? | IMAGE generation (`type: 'image'`) |
| Production wired? | PARTIAL — real API + real D1, but platform-level key, no billing, no R2 |
| Authentication? | YES — Better Auth `getCurrentUser()`, IDOR-protected status route |
| Billing? | NONE — free generation, no `calculateCredits()` call |
| Result persistence? | YES — D1 `media_jobs` with result_url (MuAPI CDN) |
| Hidden Image Cell candidate? | VIABLE SKELETON — correct architecture, needs BYOK + billing + R2 + adapter |

**MuAPI Score: 63/100** — Pricing UNKNOWN is the dominant penalty.

---

## Phase 7 — Provider Scorecard

**Weights:** API Truth 25, CF Compat 15, Economics 20, Quality 15, Latency 10, Reliability 10, Lock-in 5

| Provider | API Truth | CF Compat | Economics | Quality | Latency | Reliability | Lock-in | **TOTAL** |
|----------|----------|-----------|-----------|---------|---------|-------------|---------|-----------|
| fal.ai | 23 | 14 | 18 | 12 | 9 | 7 | 4 | **87** |
| Replicate | 24 | 12 | 18 | 12 | 7 | 8 | 4 | **85** |
| CF Workers AI | 22 | 15 | 14 | 9 | 8 | 9 | 3 | **80** |
| OpenAI | 22 | 13 | 14 | 13 | 7 | 9 | 2 | **80** |
| Stability AI | 16 | 12 | 13 | 10 | 6 | 5 | 3 | **65** |
| Google Imagen 4 | 18 | 13 | 10 | 12 | 7 | 2 | 2 | **64** |
| MuAPI | 18 | 12 | 8 | 10 | 7 | 6 | 2 | **63** |

**Confidence level:** MEDIUM for top 4, LOW for bottom 3. UNKNOWN data points reduce confidence (not score).

---

## Phase 8 — Certification Classification

| Provider | Classification | Rationale |
|----------|---------------|-----------|
| fal.ai | **CERTIFICATION CANDIDATE** | Best score (87). Transparent pricing. Lowest complexity. Ready for experimental. |
| Replicate | **CERTIFICATION CANDIDATE** | Second-best (85). Best documentation. Webhooks. Ready for experimental. |
| CF Workers AI | **CERTIFICATION CANDIDATE** | Native advantage (80). Free tier. Per-neuron pricing unpredictable. |
| OpenAI | **TECHNICALLY VIABLE** | High quality but high cost + high lock-in. Token-based pricing. |
| Stability AI | **DISCOVERY ONLY** | Docs not fetchable. Company instability. Needs more research. |
| MuAPI | **DISCOVERY ONLY** | Pricing unknown. No SLA. Existing integration is demo-grade. |
| Google Imagen 4 | **REJECTED** | Hard shutdown 2026-08-17. Forced migration. Building on deprecated API. |

---

## Phase 9 — Recommendation

### PRIMARY PROVIDER: fal.ai

| Criterion | Score | Justification |
|-----------|-------|---------------|
| Economics | Strongest | $0.003-0.04/image, transparent, predictable margins |
| Architecture | Simplest | JSON-in, URL-out. No base64. No multipart. No async. |
| Risk | Acceptable | No SLA (mitigated by circuit breaker + Replicate fallback) |
| CF Compatibility | Excellent | Standard fetch. SDK works on Workers. |
| API Truth | Good | Official docs verified. Two gaps: rate limits, webhooks undocumented. |
| Complexity | Lowest | Sync = single function call. No polling. No webhook handler. |

### BACKUP PROVIDER: Replicate

Same FLUX models and pricing. Better documentation. Webhooks. But: async complexity + URL expiry + SDK incompatible.

### REJECTED: Google Imagen 4

Hard shutdown 2026-08-17. Building on deprecated API is unacceptable.

---

## Phase 10 — Implementation Readiness

### Existing Abstractions to Reuse

| Abstraction | File | Reuse |
|-------------|------|-------|
| `ImageGenerationProvider` interface | `src/seed/ai/image-generation-provider.ts` | Create `FalImageAdapter` |
| `resolveUserApiKey()` | `src/tree/byok/resolve-user-api-key.ts` | Wire to image routes |
| `media_jobs` D1 table | `migrations/0139`, `0267` | Store fal URL in `result_url` |
| Circuit breaker | `src/seed/security/circuit-breaker.ts` | Wrap fal calls |
| Credits calculator | `src/seed/billing/credits-calculator.ts` | Add `'fal'` service type |

### Minimum Code Required

| File | Action | Lines |
|------|--------|-------|
| `src/seed/ai/fal-image-adapter.ts` | CREATE | ~120 |
| `src/tree/byok/user-api-key-store.ts` | MODIFY (+1) | Add `'fal'` to union |
| `src/seed/billing/credits-calculator.ts` | MODIFY (+6) | Add fal rates |
| `src/app/api/v1/creative-studio/images/generate/route.ts` | MODIFY (~15) | Wire fal adapter + billing |
| `src/app/actions/image-generate-action.ts` | MODIFY (~15) | Same |
| `src/app/api/v1/creative-studio/images/[id]/status/route.ts` | MODIFY (~10) | Simplify for sync |
| `src/seed/ai/provider-registry.ts` | MODIFY (+3) | Register adapter |

**Total: ~170 lines across 7 files.**

### New Secret

`FAL_KEY` — CF Workers secret via `wrangler secret put FAL_KEY`.

BYOK path: customer enters key → encrypted in `user_api_keys` → `resolveUserApiKey(userId, 'fal', env.FAL_KEY)`.

### Certification Gates (before EXPERIMENTAL READY)

| Gate | Criteria |
|------|----------|
| G1 | `FalImageAdapter` implements `ImageGenerationProvider` exactly |
| G2 | Route uses `resolveUserApiKey()` — user key preferred, env fallback |
| G3 | `calculateCredits('fal', ...)` called before generation |
| G4 | All fal HTTP calls wrapped with circuit breaker |
| G5 | fal errors classified via `classifyError()` |
| G6 | Tier gating enforced (BASIC: Schnell only, PREMIUM+: all) |
| G7 | Status route enforces IDOR protection |
| G8 | D1 row created on submit, updated on completion |
| G9 | No secrets in code — `FAL_KEY` only via `process.env` or BYOK |
| G10 | `npm run build` exit 0. `npm test` all pass. |

### Tests Required

~20-25 new tests covering unit, integration, and E2E scenarios. E2E tests skip if `FAL_KEY` not in CI.

---

## Final Verdict

```
CURRENT IMAGE CELL:        PARTIAL
PRIMARY PROVIDER:          fal.ai
BACKUP PROVIDER:           Replicate
REJECTED:                  Google Imagen 4
PRIMARY SCORE:             87/100
CONFIDENCE:                MEDIUM
REAL RUNTIME VERIFIED:     NO
RECOMMENDED NEXT COMMAND:  SUPREME COMMAND #7 — IMPLEMENT FAL.AI IMAGE ADAPTER (EXPERIMENTAL)
```

### Notes

- **CONFIDENCE MEDIUM:** All analysis based on official docs + source code. No runtime testing.
- **REAL RUNTIME VERIFIED NO:** No fal.ai/Replicate calls made. MuAPI is only provider with real runtime evidence.
- **NEXT:** Implement fal.ai adapter experimentally, wire to existing abstractions, run G1-G10, measure real latency/cost/quality.

---

## Appendix — Evidence Map

| Claim | Source |
|-------|--------|
| MuAPI client real HTTP calls | `src/tree/clients/muapi-media-client.ts:76` |
| Image route exists and works | `src/app/api/v1/creative-studio/images/generate/route.ts` |
| BYOK not consumed by image routes | `src/tree/clients/muapi-media-client.ts:60-63` vs `src/tree/byok/resolve-user-api-key.ts` |
| `ImageGenerationProvider` interface exists | `src/seed/ai/image-generation-provider.ts:116-145` |
| fal.ai pricing $0.003-0.04 | provider-capability-truth.md §2.2 |
| Replicate rate limits 600/3000 RPM | provider-capability-truth.md §2.3 |
| Replicate URL expiry 1h | provider-capability-truth.md §2.3 |
| CF Workers AI free 10k neurons/day | provider-capability-truth.md §2.4 |
| Google Imagen 4 deprecated 2026-08-17 | provider-capability-truth.md §2.1 |
| MuAPI pricing UNKNOWN | Both reports — not documented |
| CF Workers 30s CPU, 128MB RAM | `wrangler.toml` + Cloudflare docs |

---

*Report composed from authoritative evidence. Every claim traceable to file:line or official doc section. UNKNOWN data points marked explicitly. No speculation where evidence is absent.*
