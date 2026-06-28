# Phase 4J — Anthropic API Adapter — Dev-A Report

## Status: completed

## Files Modified

| File | Delta | Note |
|------|-------|------|
| `src/lib/ai/anthropic-adapter.ts` | +78 LOC | NEW — callAnthropic fn + types |
| `src/lib/ai/anthropic-adapter.test.ts` | +115 LOC | NEW — 5 unit tests |
| `src/app/api/cron/workflow-stepper/route.ts` | +55 LOC | add anthropic branch + import |
| `src/app/api/cron/workflow-stepper/route.test.ts` | +80 LOC | add tests 9 + 10; mock anthropic-adapter; update test 6 |

## Tasks Completed

- [x] `callAnthropic({ model, messages, apiKey })` — plain fetch, CF Workers compat, no SDK
- [x] `AnthropicMessage` + `AnthropicResponse` types, zero `:any`
- [x] 5 adapter tests: happy / missing key / HTTP 500 / empty content / network throw — all pass
- [x] `'anthropic'` added to `REAL_LLM_PROVIDERS`
- [x] Anthropic branch in workflow-stepper: key present → `callAnthropic` via `callWithCache`; key absent → `llmDegraded=true` + `llm_anthropic_missing_key` warn + mock
- [x] Test 9: anthropic + key → adapter called, `recordLlmCall ok:true`
- [x] Test 10: anthropic + no key → warn + mock + `recordLlmCall ok:false + LLM_LIVE_FAILED_FALLBACK`
- [x] Test 6 updated: changed from `anthropic` (now supported) to `stub` provider to keep "unsupported provider" coverage

## Tests Status

- Adapter: 5/5 pass
- Workflow-stepper: 10/10 pass (8 existing + 2 new)
- `tsc --noEmit` on owned files: 0 errors

## Scope Surprises

- Test 6 originally tested `anthropic` as the unsupported provider. Phase 4J adds `anthropic` to `REAL_LLM_PROVIDERS`, so Test 6 needed updating. Changed to `stub` provider (cast via `as unknown as RouteDecision`) — preserves coverage intent without breaking the 4G-FIX regression test.
- `callAnthropic` throws if `apiKey` is empty string (not just undefined) — guards the downstream fetch call.

## Disjoint from Dev-B

- No files touched in `src/app/[locale]/(admin)/admin/monitoring/` or `src/lib/admin/`
- Ownership fully within `src/lib/ai/` + `src/app/api/cron/workflow-stepper/`
