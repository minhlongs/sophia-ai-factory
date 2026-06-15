# R7 Plan: BYOK Wiring (OpenRouter Integration)

**Date:** 2026-04-18 | **Duration:** Single session `/cook next step by step --auto --parallel`

**Status:** SHIPPED ✅

---

## Overview

R7 closes R6's non-blocking 4G-WIRE L-1 by extending BYOK resolution to all remaining OpenRouter call sites. Three narrow phases using identical resolver shape: `resolveUserApiKey(userId | null, 'openrouter', envFallback)`.

Commits: `0cab570` (code) + `0c0e4be` (docs). CI green, prod HTTP 200.

**Tests:** 1294 → 1300 (+6). Review 9.5/10. **0 critical, 0 high.**

---

## Phases Completed

### 7A — Workflow-Stepper OpenRouter Degrade-to-Mock (closes 4G-WIRE L-1)

**Problem:** 4G-WIRE wired Anthropic path with `if (!anthropicKey)` degrade guard, but OpenRouter sent `Bearer ${openrouterKey ?? ''}` — missing-key edge (user stored empty, env blank post-gate) → 401 caught with generic warning.

**Fix:** Added `if (!openrouterKey)` sibling guard:
- Sets `llmDegraded = true`
- Logs `event: 'llm_openrouter_missing_key'`
- Returns mock response (no fetch)

**Test:** Module mock for `@/lib/byok/resolve-user-api-key` with pass-through default. New test overrides resolver to null, asserts no fetch + `llm_openrouter_missing_key` event.

**Files:** src/lib/ai/workflow-stepper/route.ts + route.test.ts | Tests: +1

---

### 7B — Script-Generator + Caller BYOK Wire

**Context:** Inngest `generate-campaign.ts` already has `userId` in `event.data`. Service types `GenerateScriptInput` missed `userId` field.

**Changes:**
- `src/lib/services/types.ts` — `GenerateScriptInput` gains `userId?: string`
- `src/lib/inngest/functions/generate-campaign.ts` — adds `userId` pass-through
- `src/lib/ai/script-generator.ts`:
  - Imports `resolveUserApiKey`
  - Sentinel strip: `userId === 'unknown' ? null : userId`
  - Resolves `apiKey = await resolveUserApiKey(resolvedUserId, 'openrouter', process.env.OPENROUTER_API_KEY)`

**Tests (new script-generator.test.ts):**
- Real userId → resolver called correctly
- No userId → resolver called with null (sentinel verified)
- resolver returns null → falls to mock, `callWithCache` skipped

**Files:** script-generator.ts + services/types.ts + generate-campaign.ts + new .test.ts | Tests: +3

---

### 7C — Niche-Enhancer Cloud Fallback BYOK

**File:** `src/lib/discovery/affiliate-openrouter-niche-enhancer.ts`

**Priority ladder (unchanged):**
1. Per-user local mekongd (KV + D1 row)
2. Founder env-var local mekongd
3. **OpenRouter cloud fallback ← BYOK wired**

**Change:** Replace `const apiKey = process.env.OPENROUTER_API_KEY` with resolver:
```ts
const apiKey = await resolveUserApiKey(userId ?? null, 'openrouter', process.env.OPENROUTER_API_KEY)
if (!apiKey) return null
```

**Tests:**
- User key wins over env fallback
- Returns null when resolver has no keys

**Files:** affiliate-openrouter-niche-enhancer.ts + .test.ts | Tests: +2

---

## Deferred to R8 (Hygiene Follow-ups)

All follow-ups have **zero functional risk** (early-return guards in place) but required for **invariant completeness + errorClass split**:

| Item | Category | Status | Notes |
|------|----------|--------|-------|
| H-1 weekly-signals-digest | Symmetry | Deferred R8 | Early-return guard exists. BYOK adds parity. No userId context. |
| H-2 error-digest | Symmetry | Deferred R8 | Same pattern. Guard on null. Symmetry-only. |
| L-4 errorClass split | Observability | Deferred R8 | Split `LLM_LIVE_FAILED_FALLBACK` → `LLM_MISSING_KEY_FALLBACK` for Langfuse. |
| L-2 enhanceNicheScoreWithAI upstream | Wiring | Deferred R9 | No production caller threads userId. Library-ready. No caller site identified yet. |

---

## Activation Checklist

- ✅ Semantic cache: `wrangler kv put LLM_CACHE_SEMANTIC_ENABLED 1`
- ✅ BYOK end-to-end: `wrangler secret put BYOK_MASTER_KEY` + migrations 0011 → 0012 + `wrangler kv put BYOK_ENABLED 1`
- ✅ After BYOK on: All 4 major OpenRouter call sites prefer user keys when present
  - workflow-stepper ✅
  - script-generator ✅
  - niche-enhancer ✅
  - weekly-signals-digest ⏳ (R8 hygiene)
  - error-digest ⏳ (R8 hygiene)

---

## Next (R8)

**R8.1 (Hygiene):** Wire weekly-signals-digest + error-digest + errorClass split (H-1, H-2, L-4)

**R8.2 (Deferred):** UI for user BYOK management

**R8.3 (Feature):** /dashboard/byok + BYOK_KEY_SET/CLEARED signals (pending L-2 upstream resolution)

---

## Verification

- **Build:** ✅ 0 TS errors
- **Tests:** ✅ 1300/1300 pass
- **Review:** 9.5/10 (0 crit, 0 high)
- **CI:** ✅ Green
- **Prod:** ✅ HTTP 200 (shortSha match)

