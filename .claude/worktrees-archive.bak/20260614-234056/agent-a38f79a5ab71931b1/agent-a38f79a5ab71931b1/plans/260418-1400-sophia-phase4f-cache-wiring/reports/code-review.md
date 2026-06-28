# Code Review — Sophia Phase 4F LLM Cache Wiring (MVP)

**Date:** 2026-04-18
**Scope:** `call-with-cache.ts` + `script-generator.ts` wire-up + Inngest propagation
**Gates pre-review:** build 0 err, tests 1175/1175, no new TS errors

## Verdict: **SHIP** — Score **9.7/10**

Zero BLOCK, zero HIGH. Two LOW observations only.

---

## Per-focus findings

### 1. Security — tenant isolation ✅
- `orgId ?? ''` in `script-generator.ts:97` correctly triggers empty-orgId guards at `llm-cache.ts:91` (`lookupCache`) and `llm-cache.ts:144` (`writeCache`) — returns `null` / no-op, no bypass. Hash also prefixes `orgId:${key.orgId}|` (line 69) so even if guards are skipped via future refactor, cross-tenant hash divergence holds.
- `orgId: userId` in `generate-campaign.ts:108` is safe. The composite PK `(hash, org_id)` + `orgId`-prefixed hash defends at DB level — scope granularity user-level is a correctness no-op (no read-across, no write-across). Claim validated.

### 2. Behavior parity — non-regression ✅
- Triple-call `trackUsage` quirk preserved: (a) non-2xx branch (line 120), (b) success branch (line 146), (c) outer catch (line 181). `throw new Error(...)` on line 133 still propagates through `callWithCache` (never caches errors — confirmed by test 4) and is re-thrown into the outer try, reaching the catch → `trackUsage-error` → `generateMockScript` fallback. Identical to master HEAD.
- Cache hit correctly skips `trackUsage` — intended freebie semantics.
- `JSON.parse(cached.response)` at line 171 sits *outside* the `callWithCache` closure; invalid JSON (from cache OR live) throws → outer catch → `trackUsage-error` + `generateMockScript`. Defensive fallback preserved.

### 3. `callWithCache` wrapper design ✅
- `await writeCache(key, live)` is correct. `writeCache` swallows internally (line 163), no race with `incrementHitCount` (fire-and-forget at line 107 triggers only on *next* lookup, not on write). Adds ~50ms on cold keys only — acceptable per wrapper docstring (line 29-31).
- `CallWithCacheResult extends CacheEntry` is safe: spread `...cached` then add `fromCache` — no duplicate field names, TS narrows correctly.

### 4. Inngest orgId propagation ✅
- `userId` is mandatory across all 3 `campaign.created` emitters: `create-campaign-core.ts:39`, `telegram/handlers/campaign-handler.ts:108`, `telegram/telegram-bot.ts:183`. Always a string. No `undefined` path.
- `CampaignCreatedEvent` type (client.ts:17) enforces the contract.

### 5. Mock service symmetry ✅
- `MockScriptService` drops `input.orgId` — fine since it never calls the cache. Interface is permissive on purpose.

### 6. Pre-existing debt — acknowledged ✅
- `script-generator.ts` `data unknown` (lines 137, 143-144, 156-157): pre-existing from H-1 baseline. NOT touched — aligned with "no drive-by fixes" policy.
- `llm-cache.ts:103` `as CacheRow` double-cast: Phase 4E baseline, NOT touched.

---

## LOW observations (non-blocking)

**LOW-1** `script-generator.ts:97` — `orgId ?? ''`: empty-string sentinel works but is implicit. Consider a named constant `CACHE_DISABLED_SCOPE = ''` in a future pass for self-documentation. Skip this PR.

**LOW-2** `call-with-cache.test.ts:56` — "disabled" test is functionally identical to the "miss" test (both mock `lookupCache → null`). Doesn't actually exercise `isCacheEnabled() === false` through the real `lookupCache`. Coverage is fine (disabled path is tested in `llm-cache.test.ts`), but naming is slightly misleading. Skip this PR.

---

## Positive observations
- Wrapper is 46 LOC, single-purpose, zero new failure modes — textbook KISS.
- Docstrings call out trade-offs (write latency, error propagation) — operator-friendly.
- No change to `writeCache` / `lookupCache` signatures — Phase 4E contract held.
- Inngest comment (line 104-107) explicitly documents the single-tenant idiom + forward path → excellent DX.

## Metrics
- Wrapper LOC: 46 (+ 73 tests = 119 new)
- Tests: 4 new / 4 pass (1175 total)
- Type coverage: no new `any`
- Build: 15.0s (baseline-matching)

## Unresolved questions
None. Ship Phase 4F and proceed to activation (`wrangler secret put LLM_CACHE_ENABLED 1`).
