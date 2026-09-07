# Image Generation Provider — V1

> Sophia AI Factory — Real Image Generation Provider
> Date: 2026-09-07 | Status: PRODUCTION CANDIDATE

---

## Overview

Sophia's image generation cell now supports a **real provider** (OpenRouter)
with automatic fallback to the mock provider for local development.

The resolution is handled by `resolveImageProvider()` in
`forest/inngest/functions/creative-image-generate.ts`:

- **If `OPENROUTER_API_KEY` is set:** Returns `OpenRouterImageGenerationAdapter`
  (wraps the existing `OpenRouterImageAdapter` with `ImageGenerationProvider`
  interface).
- **If key is absent:** Returns `InlineMockImageProvider` (development/testing).

---

## Provider: OpenRouterImageGenerationAdapter

| Aspect | Value |
|--------|-------|
| Implements | `ImageGenerationProvider` (from `seed/ai/image-generation-provider`) |
| Base adapter | `OpenRouterImageAdapter` (from `seed/ai/providers/openrouter-image-adapter`) |
| Backend | OpenRouter API (`https://openrouter.ai/api/v1`) |
| Key requirement | `OPENROUTER_API_KEY` environment variable (BYOK) |
| Cost | Metered (varies by model: $0.02–$0.12/image) |
| Cloudflare compatible | Yes (HTTPS REST) |
| OAuth required | No |

### Supported Aspect Ratios

| Aspect Ratio | OpenRouter Size |
|-------------|-----------------|
| `16:9` | `1792x1024` |
| `9:16` | `1024x1792` |
| `1:1` | `1024x1024` |
| Default | `1024x1024` |

### Error Classification

| HTTP Status | Error Code | Retryable |
|------------|-----------|-----------|
| 401 / 403 | `AUTH_FAILURE` | No |
| 429 | `RATE_LIMIT` | Yes |
| 500+ | `SERVER_ERROR` | Yes |
| Other | `NETWORK` / `UNKNOWN` | Yes |

---

## Layer Architecture

| Layer | File | Role |
|-------|------|------|
| seed | `seed/ai/image-generation-provider.ts` | `ImageGenerationProvider` interface |
| seed | `seed/ai/providers/openrouter-image-adapter.ts` | `OpenRouterImageAdapter` (Provider interface, real HTTP) |
| seed | `seed/ai/providers/openrouter-image-generation-adapter.ts` | `OpenRouterImageGenerationAdapter` (ImageGenerationProvider interface, wraps adapter above) |
| forest | `forest/inngest/functions/creative-image-generate.ts` | `resolveImageProvider()` — resolution point |

**Import direction:** seed → forest ✅ (no violations)

---

## Test Coverage

- `openrouter-image-generation-adapter.test.ts`: 10 tests
  - Happy path, empty prompt, missing API key, circuit breaker, capabilities,
    health (healthy/unhealthy), error classification (401, 429), aspect ratios
- `creative-image-generate.test.ts`: 2 provider resolution tests
  - Real adapter when key set, mock when absent

---

## VN / EN (Bilingual)

**Tiếng Việt:**

# Nhà cung cấp Sinh ảnh — V1

Sophia hiện hỗ trợ nhà cung cấp hình ảnh thực (OpenRouter) với dự phòng
tự động về mock provider khi phát triển cục bộ.

**Yêu cầu:** Biến môi trường `OPENROUTER_API_KEY` phải được thiết lập.

---

*Document generated: 2026-09-07 | HEAD: 47fc01546 | Plan: SUPREME COMMAND #5*