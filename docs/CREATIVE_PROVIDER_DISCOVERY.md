# Creative Provider Discovery & Capability Certification

**Supreme Command #6**
**Date:** 2026-09-07
**Status:** COMPLETE — READ-ONLY Research Mission
**Recommended Next:** SUPREME COMMAND #7 — IMPLEMENT FAL.AI IMAGE ADAPTER (EXPERIMENTAL)

---

## Executive Summary

Sophia AI Factory currently has **no production-grade Image Generation Provider**. The existing MuAPI integration provides real image generation but lacks BYOK resolution, billing, R2 self-hosting, and adapter abstraction — it is a viable skeleton, not a production Image Cell.

After evaluating 6 candidates against 7 weighted criteria (total 100 points), **fal.ai** was selected as the PRIMARY provider (87/100) and **Replicate** as BACKUP (85/100). **Google Imagen 4** was rejected (deprecated, hard shutdown 2026-08-17).

All analysis is based on official documentation and source code. No adapters were written. No credentials were used. No production source code was modified.

---

## Current State

| Aspect | Status | Evidence |
|--------|--------|----------|
| Image generation route | EXISTS — real MuAPI calls, real D1 persistence | `src/app/api/v1/creative-studio/images/generate/route.ts` |
| Provider abstraction | INTERFACE EXISTS but no real adapters | `src/seed/ai/image-generation-provider.ts` |
| BYOK resolution | EXISTS for MuAPI, NOT consumed by image routes | `src/tree/byok/resolve-user-api-key.ts` |
| Billing integration | EXISTS in calculator, NOT called by image routes | `src/seed/billing/credits-calculator.ts` |
| Circuit breaker | EXISTS | `src/seed/security/circuit-breaker.ts` |
| Asset storage | D1 metadata + MuAPI CDN URLs (no R2 self-hosting) | `migrations/0139`, `migrations/0267` |

**Verdict: PARTIAL** — Architecture exists. Real integration exists. Production gaps remain.

---

## Provider Scorecard

| # | Provider | API Truth (25) | CF Compat (15) | Economics (20) | Quality (15) | Latency (10) | Reliability (10) | Lock-in (5) | **TOTAL** | Classification |
|---|----------|---------------|----------------|----------------|--------------|--------------|------------------|-------------|-----------|----------------|
| 1 | **fal.ai** | 23 | 14 | 18 | 12 | 9 | 7 | 4 | **87** | CERTIFICATION CANDIDATE |
| 2 | **Replicate** | 24 | 12 | 18 | 12 | 7 | 8 | 4 | **85** | CERTIFICATION CANDIDATE |
| 3 | **Cloudflare Workers AI** | 22 | 15 | 14 | 9 | 8 | 9 | 3 | **80** | CERTIFICATION CANDIDATE |
| 4 | **OpenAI GPT-Image** | 22 | 13 | 14 | 13 | 7 | 9 | 2 | **80** | TECHNICALLY VIABLE |
| 5 | **Stability AI** | 16 | 12 | 13 | 10 | 6 | 5 | 3 | **65** | DISCOVERY ONLY |
| 6 | **MuAPI** (existing) | 18 | 12 | 8 | 10 | 7 | 6 | 2 | **63** | DISCOVERY ONLY |
| 7 | **Google Imagen 4** | 18 | 13 | 10 | 12 | 7 | 2 | 2 | **64** | REJECTED |

---

## Recommendation

### PRIMARY: fal.ai (87/100)

**Why fal.ai wins:**
- **Transparent pricing:** $0.003/image (FLUX Schnell) to $0.04/image (FLUX Pro). Per-megapixel or per-image. No token-based variance.
- **Simplest architecture:** JSON-in, URL-out. No base64 decode. No multipart. No async polling needed.
- **Lowest operational complexity:** Sync mode means single function call, no webhook/polling infrastructure.
- **CF Workers compatible:** Standard `fetch`. SDK works on Workers.
- **Low lock-in:** FLUX models available on Replicate, Cloudflare, self-hosted.

**Risk:** No documented SLA. No public uptime history. Rate limits not documented. Mitigated by circuit breaker + Replicate fallback.

### BACKUP: Replicate (85/100)

**Why Replicate is backup:**
- Same FLUX models and pricing as fal.ai.
- Best-documented API with first-class webhooks.
- More enterprise-ready (600/3000 RPM documented).

**Why not primary:** Async model requires more infrastructure. URL expiry (1h) requires R2 download. SDK incompatible with Workers.

### REJECTED: Google Imagen 4 (64/100)

**Why rejected:** Hard shutdown 2026-08-17. Any integration will break. Forced migration to different API shape.

---

## Implementation Readiness (fal.ai)

| Item | Detail |
|------|--------|
| **Code estimate** | ~170 lines across 7 files |
| **Existing reuse** | `ImageGenerationProvider` interface, `resolveUserApiKey()`, `media_jobs` D1, circuit breaker |
| **New secret** | `FAL_KEY` (CF Workers secret) |
| **New event** | `creative-studio/image.generate.requested` (recommended, not required for experimental) |
| **New storage** | None for experimental. R2 `IMAGE_BUCKET` for production hardening. |
| **Tests** | ~20-25 new tests (unit + integration + E2E) |
| **Certification gates** | 10 gates (G1-G10) must pass before EXPERIMENTAL READY |

See `plans/reports/creative-provider-discovery.md` for full implementation readiness details.

---

## Evidence Sources

| Report | Scope | Phases |
|--------|-------|--------|
| `plans/reports/repo-truth-muapi-due-diligence.md` | Source code verification | Phase 0, 6 |
| `plans/reports/provider-capability-truth.md` | Official API documentation | Phase 1, 2, 5 |
| `plans/reports/provider-scorecard-certification.md` | Architecture analysis + scoring | Phase 3, 4, 7, 8, 9, 10 |

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

**CONFIDENCE: MEDIUM** — based on official docs + source code, not runtime testing. fal.ai rate limits and SLA undocumented. No independent quality benchmarks cited.

**NEXT COMMAND:** `SUPREME COMMAND #7 — IMPLEMENT FAL.AI IMAGE ADAPTER (EXPERIMENTAL)`

---

*Generated by orchestration pipeline. All claims traceable to source code or official documentation.*
