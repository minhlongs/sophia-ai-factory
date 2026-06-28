# Code Review — Phase 4G + 4H Combined Shipment

**Date:** 2026-04-18
**Scope:** 1 modified + 3 new files (dark-launched real LLM in workflow-stepper + admin cache-stats JSON endpoint)
**Tests:** 1193/1193 green | 0 new tsc errors | Lint clean

---

## Score: **9.5/10**

## Verdict: **SHIP** (auto-ship threshold met)

---

## Scope Reviewed

- MODIFIED `src/app/api/cron/workflow-stepper/route.ts` (+78 LOC, executeStep gated)
- NEW `src/app/api/cron/workflow-stepper/route.test.ts` (213 LOC, 5 tests)
- NEW `src/app/api/admin/llm-cache-stats/route.ts` (43 LOC)
- NEW `src/app/api/admin/llm-cache-stats/route.test.ts` (84 LOC, 4 tests)

Supporting reads: `llm-router.ts`, `call-with-cache.ts`, `llm-cache.ts`, `llm-cache-purge/route.ts`, `monitoring-queries.ts`.

---

## Priority Analysis

### 1. Correctness — PASS
- Env gate `isRealLlmEnabled()` requires BOTH `WORKFLOW_REAL_LLM_ENABLED==='1'` AND truthy `OPENROUTER_API_KEY`. Short-circuits cleanly; either missing → mock path (test 1 + test 2 verify).
- Fallback path (gate off, cache miss threw, or non-ok OpenRouter) always writes a deterministic mock string; DB transitions (queued→running→completed) unchanged.
- Test 5 asserts `executeStep` swallows + logs + still resolves — dark-launch invariant holds.
- `llm-cache-stats` reuses the same `verifyCronSecret` pattern as `llm-cache-purge` (NODE_ENV dev bypass, Bearer check, missing-secret → 401). `ok:false` degradation paths both return HTTP 200 as claimed.

### 2. Security — PASS with 1 MEDIUM
- **Auth:** Both routes gated by `CRON_SECRET` Bearer. Secret never logged; `llm-cache-stats` never echoes the header.
- **Secret exposure:** `process.env.OPENROUTER_API_KEY` flows only into the `Authorization` header of the outbound fetch. Not logged. The `logger.warn` on fallback only emits `{ workflowId, model, err }` — `err` comes from our own `Error('OpenRouter 503...)'` path, not raw response body, so no key leak risk.
- **SSRF:** URL is a hardcoded literal `'https://openrouter.ai/api/v1/chat/completions'`. No user-controlled host/path/query. Not vulnerable.
- **Input hardening (MEDIUM):** `workflow.prompt` is sent verbatim to OpenRouter and embedded as `system` content with `stepType` interpolation (`` `...step type: ${stepType}` ``). If `stepType` is ever attacker-controlled (currently from `missions.params.step_type`, which is system-written), prompt injection risk exists. Non-blocking today but worth noting for the inevitable UGC step type.

### 3. Test honesty — PASS
- Test 3 asserts `callWithCache` returns cached entry AND verifies `fetch` was never called (hits real cache-hit branch).
- Test 4 uses `mockImplementation` to pass `fetchLive` through, **actually invokes global `fetch`** stubbed to return a real `Response` object, and asserts the live response text is the one persisted to D1. This exercises the OpenRouter response-parsing code (`data.choices[0]?.message?.content`) — not pure mock theater.
- Test 5 forces `callWithCache` to reject and verifies the warn + mock-fallback + no throw.
- `llm-cache-stats.test.ts` mocks the query layer (reasonable; those queries have their own tests) but asserts the three status codes (401, 200 ok:true, 200 ok:false with two distinct reasons) are correctly routed. Not testing the D1 SQL is acceptable because `getCacheStats` is shared with the admin page and already covered.

One minor gap: no test for the `result` fallback when `cacheResult.response` is an empty string (line 140 `|| 'Step ${stepType} completed…'`). Low value.

### 4. Dark-launch safety — PASS (STRONG)
- Default prod state (`WORKFLOW_REAL_LLM_ENABLED` unset or `!== '1'`) → identical to pre-shipment behavior (mock string only). Test 1 explicitly verifies `callWithCache` and `fetch` are never touched.
- Missing key with flag on → also mock path (test 2). Belt-and-suspenders: needs BOTH. Good.
- Live-path exception → warn + mock (test 5). No propagation = workflow progress preserved.

### 5. Error-swallowing rationale — ACCEPTABLE
Comment at lines 93–97 + 143–144 documents the rationale. Agree with the call **for the dark-launch window** because:
- Workflow semantics: missions must keep advancing; a transient OpenRouter outage should not stall the whole queue.
- `recordLlmCall` still emits `ok:true` with router-selected provider/model after a silent fallback. **This is the one meaningful downside** — observability will mis-report "LLM call succeeded" on fallback paths. Acceptable while `WORKFLOW_REAL_LLM_ENABLED=0` in prod; must tighten before promotion.

### 6. Sophia conventions — PASS
- No `:any` in either new file (verified via grep).
- No `console.*` in either new file (verified). `logger.warn` only.
- Kebab-case filenames.
- `export const dynamic = 'force-dynamic'` present in both.
- No Zod added — acceptable because neither endpoint accepts a JSON body (cache-stats is GET-only; workflow-stepper is cron GET with no params).

---

## Critical Issues (must-fix before ship)

**None.**

---

## Non-Critical (nice-to-have / follow-up)

1. **Medium — Provider/URL mismatch for `complex` prompts.** `routeLlm()` returns `{ provider: 'anthropic', model: 'claude-sonnet-4-6' }` for complex prompts, but `executeStep` unconditionally POSTs to `https://openrouter.ai/api/v1/chat/completions` with `OPENROUTER_API_KEY`. OpenRouter's Anthropic passthrough expects slugs like `anthropic/claude-sonnet-4.6`. Result: every `complex`-classified workflow will hit the live-fail path → silent mock fallback + misreported `ok:true` in telemetry. Fix: either (a) branch on `decision.provider` to call the right endpoint/key, or (b) map Anthropic model slugs to OpenRouter form before the fetch. Low urgency because gate is dark-launched in prod, but a correctness landmine if someone flips the flag without realizing. File a follow-up before 4G promotion.

2. **Low — Unused `promptHash` computed + `void promptHash`.** `sha256Hex(workflow.prompt)` runs on every real-LLM call but is never actually used as the cache key (cache key derives from the CacheKey struct inside `llm-cache.ts`). Dead compute per call. Comment says "conceptual key"; drop the call entirely or wire it into telemetry.

3. **Low — `recordLlmCall(ok:true)` fires on swallowed failures.** Telemetry will say the call succeeded when in reality the fetch threw and we used the mock. Consider passing `ok: false, errorClass: 'fallback-to-mock'` on the swallow branch so the breakdown metric stays honest.

4. **Low — `result` fallback for empty `cacheResult.response`** (line 140) is uncovered by tests. A pathological OpenRouter reply with empty content would silently reuse the mock template. Add 1-line test or remove the fallback.

5. **Low — `llm-cache-stats` has no retry / no `no-store` header on the JSON.** Not required for ops tooling; mention only for completeness. Response should arguably include `Cache-Control: private, no-store` so curl-in-a-loop monitoring doesn't get a proxy-cached page.

6. **Informational — Prompt-injection posture.** `stepType` is interpolated into the system prompt. Safe today (system-written), but if step types ever come from user input, escape or validate them.

---

## Positive Observations

- Excellent dark-launch hygiene: two-flag gate, exception → warn + fallback, zero behavior delta when disabled, verified by dedicated test.
- Both handlers use the exact same auth pattern as existing cron/admin routes (consistency win).
- Test 4 goes the extra mile and exercises real `Response`-body parsing instead of shortcutting with a pure mock — this catches regressions in the OpenRouter response shape.
- `llm-cache-stats` follows the "degrade to 200 ok:false" pattern already established in `llm-cache-purge` — ops callers get one status-code contract.
- Comments at 87–97 and 143–144 explain the *why* (swallow rationale, BYOK defer), not just the what.

---

## Metrics

| Check | Result |
|---|---|
| Tests | 1193/1193 pass |
| New tests | +9 (5 stepper + 4 cache-stats) |
| TypeScript errors | 0 |
| `:any` in new code | 0 |
| `console.*` in new code | 0 |
| Lint | clean |
| Convention adherence | 100% |

---

## Unresolved Questions

1. Is the OpenRouter ↔ Anthropic model-slug mismatch (issue #1 above) intentional for 4G or an oversight? Recommend resolving before `WORKFLOW_REAL_LLM_ENABLED=1` is flipped in prod.
2. Should `recordLlmCall` reflect fallback as a failure event (issue #3) to keep the signals-breakdown dashboard honest during the dark-launch observation window?

---

## One-Sentence Summary

Combined 4G+4H shipment is production-ready behind a belt-and-suspenders dark-launch gate with honest tests and zero behavioral delta when disabled; ship now and track the OpenRouter/Anthropic provider-routing mismatch as a follow-up before the flag is ever flipped in prod.
