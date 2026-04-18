---
name: Sophia Round 2 Parallel — Phase 4G-FIX + Phase 4I
status: in_progress
priority: P2
estimate: 1.5h (parallel ≈ 45 min wall-clock)
session: PM-18 2026-04-18
parent: 260418-2100-sophia-parallel-4g-4h (shipped dde51a24)
pdf_bullet: Giai đoạn 4 (observability) + 6.2 (cache hygiene)
mode: --auto --parallel
---

# Round 2 — Phase 4G-FIX + Phase 4I (parallel)

Two file-disjoint slices.

## File Ownership Matrix (STRICT)

| Phase   | Owner | Files                                                                | Conflicts |
|---------|-------|----------------------------------------------------------------------|-----------|
| 4G-FIX  | Dev-A | `src/app/api/cron/workflow-stepper/route.ts` (modify)<br/>`src/app/api/cron/workflow-stepper/route.test.ts` (modify, +2 tests) | none |
| 4I      | Dev-B | `src/app/api/admin/llm-trace-stats/route.ts` (NEW)<br/>`src/app/api/admin/llm-trace-stats/route.test.ts` (NEW) | none |

Zero overlap — `cron/workflow-stepper/` vs `admin/llm-trace-stats/`.

## Phase 4G-FIX — Close reviewer follow-ups from PR dde51a24

Three low/medium reviewer findings on Phase 4G:

1. **Medium — Provider routing mismatch.** `routeLlm` returns
   `decision.provider ∈ {'openrouter', 'anthropic', 'local-mekongd', 'stub'}`
   but fetch unconditionally hits OpenRouter with the raw model slug.
   Complex prompts routed to `anthropic` → OpenRouter 404 → swallow →
   mock fallback. Operator cannot distinguish "gate working" from
   "silent under-delivery."

   **Fix:** gate live-fetch on `decision.provider === 'openrouter'` (or
   'local-mekongd' which we currently coerce to openrouter). For
   'anthropic' and 'stub', skip live fetch, fall through to mock,
   and log a structured `llm_router_unsupported` warning.

2. **Low — Telemetry dishonesty.** `recordLlmCall(ok:true)` fires on
   the success path even when live fetch was swallowed + mock
   fallback used. Dashboards will report 100% success during a
   silently-broken dark-launch.

   **Fix:** track a `llmDegraded: boolean` flag in executeStep.
   Pass `ok: !llmDegraded` + `errorClass: 'LLM_LIVE_FAILED_FALLBACK'`
   to the success-path `recordLlmCall` when degraded.

3. **Low — Empty-response fallback uncovered by tests.** Line 140
   (now ~138 after cleanup) defaults to mock string when OpenRouter
   returns empty `choices[0].message.content`.

   **Fix:** add one test case. Low priority but cheap.

**Scope-not-touched:**
- Direct Anthropic API support (out of scope — needs new adapter)
- `local-mekongd` actual routing (still coerced to openrouter until BYOK)
- Rewriting llm-router to guarantee only openrouter

**Success criteria:**
- Provider routing: `decision.provider === 'anthropic'` or `'stub'` → mock fallback without live fetch, `logger.warn` fires once
- Telemetry: `recordLlmCall` sees `ok:false, errorClass:'LLM_LIVE_FAILED_FALLBACK'` when degraded; `ok:true` otherwise
- Tests: 5 existing + 3 new (anthropic routing / telemetry degraded / empty-response fallback) = 8 total
- `tsc --noEmit` clean

## Phase 4I — Admin JSON LLM Trace Aggregates

`GET /api/admin/llm-trace-stats` returns 24h aggregates from
`signals_events WHERE event_type='llm_call_trace'`.

**Why:** Phase 4B emits per-step traces to D1, Phase 4.7 surfaces
cache stats only. Ops needs quick LLM health snapshot (success rate,
avg latency, top provider/model) without Langfuse dashboard.

**Return shape (24h window):**
```json
{
  "ok": true,
  "ts": "2026-04-18T...",
  "windowHours": 24,
  "stats": {
    "total":         N,
    "success":       N,
    "failure":       N,
    "successRate":   0.0–1.0,
    "avgDurationMs": N,
    "byProvider":    [{ "provider": "openrouter", "count": N }, ...],
    "byModel":       [{ "model": "claude-sonnet-4-6", "count": N }, ...]
  }
}
```

Degraded: `{ "ok": false, "reason": "D1_UNAVAILABLE", ... }` status 200.

**Implementation:**
- Self-contained route. Query `signals_events` directly via `globalThis.DB`
  (same pattern as `llm-cache-purge`).
- Parse `props` JSON column to extract `provider`, `model`, `duration_ms`, `ok`
- Group + aggregate in-memory (D1 does not support arbitrary SELECT GROUP BY
  on JSON columns efficiently; in-memory is fine for 24h = few thousand rows max)
- CRON_SECRET-guarded, dev bypass

**Auth:** same pattern as `llm-cache-stats` and `llm-cache-purge`. Dev env
skips secret. Production requires `Authorization: Bearer $CRON_SECRET`.

**Success criteria:**
- 401 on missing/wrong secret
- 200 `ok:true` with stats on happy path (mocked D1 results)
- 200 `ok:false` degraded when D1 missing / throws
- Handles empty result set → all zeros
- 4 unit tests: auth fail / happy path / D1 missing / D1 throws
- `tsc --noEmit` clean

## Common constraints
- Both phases ≥9.5 auto-ship threshold
- Rule #0 pipeline
- Tests 1193 → expected 1193 + 3 (4G-FIX) + 4 (4I) = 1200

## Rollback
- 4G-FIX is a polish on top of 4G's dark-launch gate — still env-gated, still safe
- 4I is a new route — delete file if needed

## Risk
- **LOW** — 4G-FIX improves correctness of gated code (still default OFF)
- **LOW** — 4I is additive-only, reuses signals_events table
