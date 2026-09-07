# Hermes Intelligence Adapter V2

> Sophia AI Factory — Hermes integration documentation
> Date: 2026-08-31 | Status: COMPLETE (no production deployment)

---

## Overview

Hermes Intelligence Adapter V2 integrates Hermes as a **text / reasoning / creative intelligence worker** into Sophia AI Factory. Hermes is **NOT** an image generation provider. The adapter provides deterministic, capability-truthful integration with correct cost semantics.

---

## Verified Capabilities (VERIFIED CAPABILITIES)

| Capability | Status | Notes |
|---|---|---|
| `chat` | ✅ Supported | Text-based creative reasoning and analysis |
| `stream` | ✅ Supported | Single-chunk streaming wrapping chat response |
| `token_count` | ✅ Supported | Approximate token counting (length / 4 + 4) |
| `creative.reason` | ✅ Supported | Structured creative reasoning via Zod-validated contracts |
| `creative.storyboard` | ✅ Supported | Structured storyboard generation with scene-level detail |
| `creative.prompt.optimize` | ✅ Supported | Prompt optimization for target platforms |
| `vision` | ✅ Input-only | Image input support (visual analysis) |

---

## Unsupported Capabilities (UNSUPPORTED CAPABILITIES)

| Capability | Status | Notes |
|---|---|---|
| `image.generate` | ❌ Explicitly Unsupported | Throws `HERMES_CAPABILITY_UNSUPPORTED` |

**Critical rule:** Never silently emulate an unsupported capability. If `image.generate` or `imageGenerate: true` is requested, the adapter throws an explicit error rather than silently failing or routing to a different provider.

---

## Security Gate (SECURITY GATE)

**Status: BLOCKED**

The external Hermes repository contains hardcoded OAuth credentials. All integration work uses mock/contract tests only. No real OAuth requests are made. No canary tests contact a live Hermes instance.

**Rules:**
- No OAuth client secrets in active source
- Environment/secret injection only
- Mock-based tests for all Hermes-specific behavior
- No production deployment until security gate passes

---

## Cost Semantics (ECONOMICS)

### CostKind Classification

The Hermes adapter uses the `CostKind` enum to provide economically honest cost reporting:

| Provider | CostKind | estimateCost | estimateCostV2 |
|---|---|---|---|
| Hermes (local) | `unmetered` | `0` | `{ usd: 0, kind: 'unmetered' }` |
| OpenRouter | `metered` | Per-token cost | `{ usd: N, kind: 'metered' }` |
| Unknown provider | `unknown` | `0` | `{ usd: 0, kind: 'unknown' }` |

### Cost-Aware Router Behavior

The cost-aware router (`selectCostAwareProvider`) uses `rankCost()` which treats `unmetered` and `unknown` providers as `(cheapestMeteredCost + EPSILON)`, ensuring they never rank below a measured provider. This prevents free/unknown providers from being selected purely on cost when a measured alternative exists.

---

## Creative Contracts (CREATIVE CONTRACTS)

### Creative Reasoning

`CreativeReasoningRequest` → `CreativeReasoningResponse` (Zod-validated, `Result<T, string>`)

Fields:
- `concept` — Core creative concept
- `rationale` — Why this concept works
- `audienceFit` — Target audience alignment
- `riskFactors` — Array of potential risks
- `alternatives` — Array of alternative concepts

### Storyboard Generation

`CreativeStoryboard` with `CreativeScene[]` (Zod-validated, `Result<CreativeStoryboard, string>`)

Each scene contains:
- `sceneId`, `duration`, `purpose`, `visualDescription`
- `camera`, `subject`, `emotion`
- `imagePrompt`, `negativePrompt` (optional)

### Prompt Optimization

`PromptOptimizeRequest` → `PromptOptimizeResponse` (Zod-validated, `Result<T, string>`)

Fields:
- `optimizedPrompt` — The optimized prompt text
- `changes` — Array of changes made
- `confidence` — Confidence score (0-1)

---

## Circuit Breaker Integration

The adapter integrates with Sophia's circuit breaker system (`shouldAllowRequest` / `recordSuccess` / `recordFailure`). The circuit breaker operates on the `hermes-antigravity` service name.

- **CLOSED** → normal operation
- **DEGRADED** → reduced capacity (requests allowed)
- **OPEN** → all requests blocked during cooldown
- **HALF_OPEN** → single probe request allowed

---

## Capability Discovery

Hermes capabilities are defined in `hermes-capabilities.ts` as a `HermesCapabilitySet` interface with literal boolean values. The `getCapabilities()` method on the adapter derives its return value from `getHermesCapabilities()`.

---

## Limitations

1. **No image generation** — Hermes is a text/reasoning worker only
2. **Local-only cost model** — `estimateCost()` returns 0 (backward-compat); `estimateCostV2()` returns `unmetered`
3. **Security gate blocked** — No real OAuth or canary until credential remediation
4. **Single-chunk streaming** — `stream()` wraps `chat()` response in one chunk
5. **Approximate token counting** — Uses heuristic (length / 4 + 4), not a real tokenizer

---

## Files Changed

| File | Status | Description |
|---|---|---|
| `src/seed/ai/providers/hermes-capabilities.ts` | NEW | Capability truth definitions |
| `src/seed/types/creative-intelligence.ts` | NEW | Creative reasoning + prompt optimization contracts |
| `src/seed/types/creative-storyboard.ts` | NEW | Structured storyboard schema |
| `src/seed/ai/providers/hermes-antigravity-adapter.ts` | MODIFIED | Capability guard + getCapabilities derivation |
| `src/seed/ai/cost-estimator.ts` | MODIFIED | CostKind + estimateCostV2 + getModelCostKind |
| `src/forest/ai/cost-aware-router.ts` | MODIFIED | rankCost for UNKNOWN/unmetered providers |
| `src/seed/types/creative.ts` | MODIFIED | Barrel export for new types |
| `src/seed/ai/providers/__tests__/hermes-intelligence-adapter.test.ts` | NEW | 17 mock contract tests (9 categories) |
| `src/seed/ai/providers/__tests__/hermes-antigravity-adapter.test.ts` | MODIFIED | +61 lines for V2 capability tests |

---

## Thai/EN Keywords

**Thai:** ตัวแทน Hermes Intelligence V2 | ความสามารถที่ตรวจสอบแล้ว | ต้นทุนตามประเภท | สัญญาณสร้างสรรค์ | โครงสร้างเรื่องราว
**EN:** Hermes Intelligence Adapter V2 | Verified Capabilities | CostKind-aware Economics | Creative Contracts | Structured Storyboard