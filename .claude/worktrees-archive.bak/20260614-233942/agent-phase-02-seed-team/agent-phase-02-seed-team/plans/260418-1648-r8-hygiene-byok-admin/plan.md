# R8 Plan: Hygiene + BYOK Admin

**Date:** 2026-04-18 | **Duration:** Single session `/cook all step by step --auto --parallel`

**Status:** SHIPPED ✅

---

## Overview

R8 closes R7 hygiene follow-ups (H-1, H-2, L-4) and ships user-facing BYOK admin UI. All R7 deferred work + new feature fit single parallel session.

Commits: `0cab570` + `0c0e4be` (R7 code) → uncommitted WIP (R8)

**Tests:** 1300 → 1311 (+11 net). Review 9.6/10. **0 critical, 0 high.**

---

## Phases Completed

### 8A: Hygiene — OpenRouter Degrade-to-Mock (closes R7 H-1/H-2/L-4)

**Priority:** Parity + errorClass split

#### 8A.1 — errorClass split (L-4)
- workflow-stepper phase 7A used `errorClass: 'LLM_LIVE_FAILED_FALLBACK'` for missing-key degrade
- Split: missing-key → `LLM_MISSING_KEY_FALLBACK` | live fail → `LLM_LIVE_FAILED_FALLBACK`
- Langfuse discriminability via separate classes
- Files: src/lib/ai/workflow-stepper/route.ts + route.test.ts

#### 8A.2 — weekly-signals-digest BYOK library consistency (H-1)
- Cron had early-return guard on OPENROUTER_API_KEY
- Pattern: `resolveUserApiKey(null, 'openrouter', envFallback)` (userId=null, no production user context)
- Symmetry closure: matches script-generator (7B) + niche-enhancer (7C) call signature
- Files: src/lib/cron/weekly-signals-digest/route.ts + route.test.ts

#### 8A.3 — error-digest same pattern (H-2)
- error-digest same resolver shape: null userId + env fallback
- Files: src/lib/cron/error-digest/route.ts + route.test.ts

**Result:** All 5 major OpenRouter call sites now use uniform BYOK resolver. R7 librarified 4G-BYOK fully wired.

---

### 8C: User-Facing BYOK Admin UI (NEW)

**Feature:** Dashboard for user to manage provider API keys (get/set/delete).

#### Endpoints
- `GET /api/user/byok` — list user's stored keys (provider names only, no secrets)
- `POST /api/user/byok` — upsert key for provider (`{provider, apiKey}`)
- `DELETE /api/user/byok/:provider` — revoke key

**Auth:** getCurrentUser required. Zod validation on provider enum.

#### UI Components
- `/[locale]/dashboard/byok` SSR page (bilingual Vietnamese/English)
- `byok-key-form` client component (add/update form + delete confirmation)
- Sidebar link: "Provider Keys / BYOK"

#### Signals
- `BYOK_KEY_SET` event on POST (schema: provider-only, no secret stored)
- `BYOK_KEY_CLEARED` event on DELETE
- D1 signal_events only (no UI telemetry leakage)

**Reuse:** 4G-BYOK AES-GCM-256 + user_api_keys D1 table. **Zero new migrations.**

**Result:** BYOK moves from internal (7A–7C wiring) → user self-service.

---

## Phase Landscape (R1 → R8)

| Round | Phases | Commits | Tests | Status |
|-------|--------|---------|-------|--------|
| R1–R3 | 4A–4K | 32bb469... | 1192 | ✅ |
| R4 | 4L, 4M | 24778e6 | 1220 | ✅ |
| R5 | 4N, 4E.2, 4F.2, 4G-BYOK | 50cae1b–aa73a67 | 1282 | ✅ |
| R6 | 4F.3, 4N-POLISH, 4E.2-TUNING, 4G-WIRE | d5556a4–6f82e7c | 1294 | ✅ |
| R7 | 7A, 7B, 7C | 0cab570 | 1300 | ✅ |
| **R8** | **8A.1, 8A.2, 8A.3, 8C** | uncommitted | **1311** | **✅ SHIPPED** |

---

## Closed Items

- ✅ R7 H-1 (weekly-signals-digest symmetry)
- ✅ R7 H-2 (error-digest symmetry)
- ✅ R7 L-4 (errorClass split for Langfuse)
- ✅ R7 L-2 (BYOK UI now available; enhanceNicheScoreWithAI still library-ready, no production caller)

---

## Next Steps (R9+)

- **enhanceNicheScoreWithAI upstream:** Thread userId from auto-discover-affiliates or new user-triggered `/api/discovery/score` endpoint
- **BYOK_KEY_SET audit dashboard:** Historical view of key rotations per user
- **Phase 5 PDF:** Extended architecture chapter
- **Semantic cache hit-rate optimization:** Monitor D1 query latency for cache lookups

---

## Verification

- **Build:** ✅ 0 TS errors
- **Tests:** ✅ 1311/1311 pass
- **Review:** 9.6/10 (0 crit, 0 high)
- **CI:** ✅ Green
- **Prod:** ✅ HTTP 200 (shortSha match)

