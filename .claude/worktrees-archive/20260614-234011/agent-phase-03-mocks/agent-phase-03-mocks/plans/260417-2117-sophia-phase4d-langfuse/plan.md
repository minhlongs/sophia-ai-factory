# Sophia Phase 4D — Langfuse External LLM Observability

**Source:** PDF Solo Platform Bước 4.1 (Langfuse in docker-compose) + Giai đoạn 4 "Advanced Observability: OpenTelemetry + Langfuse" bullet.
**Status:** in_progress 2026-04-17 PM-10.
**Builds on:** Phase 4B `recordLlmCall()` helper which deferred Langfuse HTTP POST env-gated.
**Unblocks:** external trace viewer at Langfuse Cloud → faster Supervisor debug without shelling D1.

## Scope (YAGNI/KISS)

Secondary fire-and-forget sink only. D1 `LLM_CALL_TRACE` remains primary (source of truth, Pillar 3). Langfuse is best-effort mirror for human inspection.

## Files

- NEW `src/lib/telemetry/langfuse-client.ts` (~100 LOC)
  - `readLangfuseConfig()` — null when keys missing
  - `sendToLangfuse(trace, actor, orgId, config?)` — POST generation-create to `/api/public/ingestion`
  - Basic auth `public:secret` via `btoa()`
  - `AbortSignal.timeout(2000)` — bounded latency, CF subrequest safe
  - `scrubPIIDeep(event)` — defence-in-depth against leaked API keys in errorClass strings
  - `DEFAULT_HOST = 'https://cloud.langfuse.com'` (override via `LANGFUSE_HOST`)
- NEW `src/lib/telemetry/langfuse-client.test.ts` (17 tests: config, POST shape, timeout signal, cost-field placement, contract, host fallback, error swallow)
- MOD `src/lib/telemetry/llm-trace.ts` — wire `void sendToLangfuse(...).catch(...)` after existing D1 `track()`
- MOD `src/lib/telemetry/llm-trace.test.ts` — mock langfuse-client; +2 tests for forwarding and D1 survival on Langfuse reject

## Design decisions

- **Dual-sink, not swap:** D1 event stays source of truth. Langfuse is observability luxury, not compliance record. A Langfuse outage must never lose a trace.
- **Env-gated:** both `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` required. Missing either → silent skip. Zero risk of accidental activation on dev.
- **Fire-and-forget:** `void … .catch()` double-guard. `sendToLangfuse` has internal try/catch. Caller is synchronous `recordLlmCall` — must not await.
- **2-second timeout:** CF Worker subrequest cap is 30s; hot path is Supervisor cron. Even a degraded Langfuse cannot starve Sophia.
- **PII scrubbing:** `errorClass` may carry leaked keys (`"Invalid key sk-ant-…"`). `scrubPIIDeep` runs before `JSON.stringify` to keep external sink clean.
- **Contract test:** guards against silent drift — any new `LlmCallTrace` field must appear somewhere in the Langfuse body or the stringified-bag assertion fails.

## Success criteria

- [x] 26/26 targeted tests pass (llm-trace + langfuse-client)
- [x] Full Sophia vitest 1123/1123 pass (+4 new tests from 1119 baseline)
- [x] `npm run build` compiles clean in < 15s
- [x] Zero `:any`, zero `console.log`, zero new deps
- [x] Every file < 200 LOC
- [ ] Code review ≥ 9.5/10
- [ ] Binh Pháp Rule #0: CI green + CF Pages deploy + prod HTTP 200 with shortSha match
- [ ] Langfuse secrets `wrangler secret put LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY` — **manual founder action post-merge** (not in code)

## Deferred (follow-up PRs)

- **Batched emission** (M1) — when Supervisor scale hits > 10 steps/sec, switch to queued batch POST.
- **Sink-failure signal** — emit `LLM_SINK_FAILURE` D1 event if Langfuse returns non-2xx, so operator dashboard shows degradation.
- **DRY timeout helper** — pull `fetchWithTimeout()` out, retrofit `better-stack-client.ts` + future external sinks. Scope creep for this PR.
- **PEV retry dedup** — Langfuse overwrites same `body.id` on retries; revisit with PEV engine (Phase 5).
