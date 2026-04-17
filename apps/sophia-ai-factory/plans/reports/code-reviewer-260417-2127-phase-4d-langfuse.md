# Code Review — Sophia Phase 4D Langfuse Activation

**Reviewer:** code-reviewer
**Date:** 2026-04-17 21:27
**Scope:** 4 files (~90 LOC impl + 22 tests)
**Score: 8.5 / 10** — ship-it with 2 high-pri fixes before heavy prod traffic.

---

## Scope
- NEW  `src/lib/telemetry/langfuse-client.ts`
- NEW  `src/lib/telemetry/langfuse-client.test.ts` (13 tests)
- MOD  `src/lib/telemetry/llm-trace.ts` (wire secondary sink, +4 LOC)
- MOD  `src/lib/telemetry/llm-trace.test.ts` (+2 tests)

Build/tests/full-suite already green per hand-off (1119/1119).

---

## Overall Assessment
Clean mirror of the existing `better-stack-client.ts` pattern — same env-gated fire-and-forget shape, same "telemetry must never break caller" doctrine, same lack of retries. Secondary sink wiring in `llm-trace.ts` uses correct `void … .catch()` double-guard; `sendToLangfuse` itself already swallows, so the extra `.catch` is defensive belt-and-suspenders. Zod drift guarded by existing `llm-trace.test.ts` "emits fields that match LlmCallTraceSchema" test (that schema covers the `track()` payload, not the Langfuse payload — see M1 below).

YAGNI/KISS/DRY respected. File sizes 90/180/180 LOC — comfortably under 200-line rule. Naming kebab-case. No `:any`. No `console.log`. No `await` on `createServerClient` (N/A — it's not called here).

---

## Critical Issues
None. Caller can't throw: `recordLlmCall` is sync, the Langfuse call is `void … .catch(...)`, `sendToLangfuse` has its own try/catch. Credentials never cross an error boundary (see H1 — no `.error` logging).

---

## High Priority

### H1. Missing timeout → retry-storm risk when Langfuse is slow/down
`sendToLangfuse` calls `fetch(...)` with NO `AbortSignal.timeout()`. On CF Workers, a single request has a 30 s wall-clock subrequest cap; a stuck Langfuse socket can hold a worker invocation open until runtime kills it. Under a degraded cron (stepper fires every minute × N active workflows), you can easily burn the whole subrequest budget before CF aborts.

Same concern applies to `better-stack-client.ts` — so this is a pattern-wide gap, not a regression — but Phase 4D is the first sink that rides on the Supervisor cron hot path, making the blast radius bigger.

**Fix (5 LOC):**
```ts
await fetch(`${host}/api/public/ingestion`, {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({ batch: [event] }),
  signal: AbortSignal.timeout(2000),   // 2 s is generous for telemetry
})
```
Also consider bumping `better-stack-client.ts` in the same PR (DRY: maybe one `fetchWithTimeout` helper in `src/lib/telemetry/`).

### H2. Zod-schema drift blind spot
Existing test `'emits fields that match LlmCallTraceSchema'` validates the **D1 `track()` payload** against `LlmCallTraceSchema`. It does NOT validate the **Langfuse body**. If someone ever adds a new field to `LlmCallTrace` (e.g. `reasoningTokens`), they'll remember to extend `LlmCallTraceSchema` (CI will tell them), but they can silently forget `langfuse-client.ts`'s `body.metadata` / `body.usage`. Langfuse will accept the partial payload → silent observability loss.

**Fix:** add a contract test that locks the Langfuse body shape against `LlmCallTrace`:
```ts
// langfuse-client.test.ts
it('emits every LlmCallTrace field into either body.* or body.metadata.*', async () => {
  // Assert keys of LlmCallTrace ⊆ keys of body ∪ body.metadata ∪ body.modelParameters
})
```
Cheap (10 LOC) and it stops the most likely future regression.

---

## Medium Priority

### M1. `body.id` collision risk on same-step retries
Spec (Langfuse docs): *"event id within the envelope is used to deduplicate messages; event.body.id is the ID of the actual observation and will be used for updates"*. Current code:
- envelope `id = "{workflowId}-step-{N}-evt"` ← stable
- body `id = "{workflowId}-step-{N}"` ← stable

Benefit: retries (workflow stepper re-runs step 2 after transient fail) dedup cleanly. **Downside**: the failing attempt AND the succeeding attempt share `body.id`, so Langfuse will overwrite the first observation's `ok=false / errorClass=...` with the second's `ok=true`. The D1 signal keeps BOTH rows (immutable event log), so you lose fidelity only on the Langfuse side.

Not a blocker for MVP — Supervisor stepper has "raced — another worker completed it" guard at line 81 of `workflow-stepper/route.ts`, so the double-emit window is narrow. But once PEV retries land (Phase 5), this becomes lossy. Consider `body.id = `${traceId}-${Date.now()}`` (breaks dedup intent) OR `body.id = `${traceId}-${attemptNumber}`` when attempt-number is available.

### M2. `durationMs: Date.now() - startedAt` leaks to Langfuse metadata but usage-token fields don't carry currency
`body.usage.unit: 'TOKENS'` correctly marks the unit, but `body.metadata.costUsd` is a naked number — Langfuse's cost UI expects `body.usage.totalCost` (or `input_cost` / `output_cost`) in USD at the `body.usage` level, not metadata. As-is, the cost won't show up in Langfuse's cost dashboards — only in custom metadata views.

**Fix:** move cost into the canonical field:
```ts
usage: {
  input:       trace.inputTokens,
  output:      trace.outputTokens,
  unit:        'TOKENS',
  totalCost:   trace.costUsd,   // Langfuse understands this
},
```

### M3. No explicit PII scrubber on metadata values
`trace.errorClass` can contain arbitrary error messages. In the caller (`workflow-stepper/route.ts:118`) we see `error_class: msg.slice(0, 200)` — that msg can include provider error text, which historically has leaked API keys ("Invalid key sk-ant-…"). D1 side is covered by the signals pipeline's `scrubPIIDeep` (should verify), but Langfuse side is NOT running through `scrubPIIDeep`.

**Recommended fix (3 LOC):**
```ts
import { scrubPIIDeep } from './pii-scrubber'
// in sendToLangfuse, just before JSON.stringify:
const safeEvent = scrubPIIDeep(event) as typeof event
body: JSON.stringify({ batch: [safeEvent] }),
```
This is defence-in-depth at zero cost — matches Sophia's `scrubPII BEFORE any external push` doctrine in `pii-scrubber.ts:4`.

### M4. `btoa` on non-ASCII secret keys will throw
`btoa(`${publicKey}:${secretKey}`)` throws `InvalidCharacterError` if either key contains a character > U+00FF. Langfuse keys are ASCII today (pk-lf-…/sk-lf-…), so this is defensive, but the throw happens *before* the try/catch → propagates up → hits the double-guard `.catch` in `llm-trace.ts` → swallowed. So already safe at caller. **Keep as-is; note-only.**

---

## Low Priority

### L1. DEFAULT_HOST string duplicated as test expectation
`'https://cloud.langfuse.com'` appears in both `langfuse-client.ts:15` and `langfuse-client.test.ts:83`. Consider `export const DEFAULT_HOST` so the test imports the constant — future host change is a one-liner.

### L2. `metadata.orgId` undefined serialization
When `orgId` is undefined, `JSON.stringify({ ..., metadata: { orgId: undefined } })` will just omit the key (JS behaviour) — no bug, but worth a test asserting `body.metadata` does NOT contain a literal `"orgId":null` (current tests only check the positive case).

### L3. Comment drift in `llm-trace.ts:5`
Old header comment says "ships per-step LLM call metadata to D1 signals_events (primary) and to Langfuse /api/public/ingestion (secondary, env-gated)." ✅ Already updated correctly.  Ignore; false alarm on my part.

---

## Edge Cases Found by Scout

| # | Scenario | Outcome |
|---|----------|---------|
| 1 | `LANGFUSE_PUBLIC_KEY` set, `LANGFUSE_SECRET_KEY` empty | `readLangfuseConfig()` returns `null` → no fetch, caller unaffected. ✅ covered by test. |
| 2 | `fetch` hangs 60 s | No timeout → CF kills worker on 30 s cap. ⚠️ H1. |
| 3 | `btoa` receives U+00FF+ char | Throws before try/catch → propagates to `llm-trace.ts`'s `.catch` → swallowed. ✅ safe. |
| 4 | `trace.errorClass` contains `"sk-ant-abc…"` | Sent verbatim to Langfuse. ⚠️ M3. |
| 5 | Supervisor cron fires same `workflowId+stepOrder` twice (race) | Langfuse overwrites observation (dedup by `body.id`). ⚠️ M1. D1 keeps both. |
| 6 | `process.env.LANGFUSE_HOST = ''` (set but empty) | `cfg.host ?? DEFAULT_HOST` — `''` is not nullish → uses empty string → fetch `/api/public/ingestion` (invalid URL). ❌ small bug, see L4 below. |
| 7 | `LANGFUSE_HOST = 'https://self.example.com/'` (trailing slash) | Produces `https://self.example.com//api/public/ingestion` — double slash — most servers tolerate, Cloudflare does. 🟡 cosmetic. |
| 8 | Langfuse returns 207/400/500 | Response not inspected — sunk silently. Acceptable for fire-and-forget, but monitoring gap. Consider a `metrics.ts` counter `langfuse_send_failures_total` for future dashboards. |

### L4. `LANGFUSE_HOST=''` edge
`cfg.host ?? DEFAULT_HOST` uses nullish coalescing. If env var is literally the empty string, `?? ` does NOT fall back. Guard with:
```ts
const host = cfg.host?.trim() || DEFAULT_HOST
```

---

## Positive Observations

1. **Pattern consistency** — mirrors `better-stack-client.ts` perfectly. Reviewer-muscle-memory friendly.
2. **Deterministic trace id re-use** — `buildTraceId(workflowId, stepOrder)` shared between both sinks (D1 props and Langfuse body) → cross-system joins possible.
3. **Tests cover both positive and failure paths** — especially `'still emits to D1 even if Langfuse sink rejects'` which proves no regression risk on Phase 4B's primary sink.
4. **Fire-and-forget correctness** — `void x.catch()` is the right shape for sync caller + async side-effect. Small `recordLlmCall` stays sync → zero caller-refactor churn.
5. **Explicit config override** parameter on `sendToLangfuse` → easy DI for tests; good practice.
6. **No secret-material in logs** — code never `console.error(cfg)` or `throw new Error(... auth ...)`. Compliant with zero-console doctrine.
7. **Under-200-LOC rule respected** cleanly in every file.

---

## Recommended Actions (priority order)

1. **[H1, ~5 LOC]** Add `AbortSignal.timeout(2000)` to the `fetch` in `sendToLangfuse` and (consistency) `better-stack-client.ts`. DRY into a tiny `fetchWithTimeout` helper in `src/lib/telemetry/`.
2. **[M3, ~3 LOC]** Apply `scrubPIIDeep(event)` immediately before `JSON.stringify({ batch: [...] })`. Matches project's "scrub BEFORE any external push" doctrine.
3. **[H2, ~10 LOC]** Add contract test in `langfuse-client.test.ts` that asserts every `LlmCallTrace` field lands somewhere in the Langfuse body — prevents silent observability drift.
4. **[M2, 2 LOC]** Move `costUsd` from `metadata.costUsd` into `usage.totalCost` so Langfuse cost dashboards populate.
5. **[L4, 1 LOC]** `cfg.host?.trim() || DEFAULT_HOST` — guard empty-string env.
6. **[M1, defer to Phase 5/PEV]** Decide `body.id` strategy when retries become first-class (include attempt number).
7. **[L1, 1 LOC]** Export `DEFAULT_HOST` so tests can import it.

Fixes 1–4 are worth rolling into THIS PR (<30 LOC total, zero semantic risk). 5–7 can be a follow-up micro-PR.

---

## Metrics
- Type coverage: ✅ 100 % (no `:any`, explicit `LangfuseConfig` interface, `LlmCallTrace` shared type).
- Test coverage: ✅ 22 tests (13 new + 2 added = 22 exercised paths for this phase). Positive + failure paths both covered except the contract test (H2).
- Linting: 0 issues in review scope.
- Build: `✓ Compiled successfully in 14.9s` (pre-existing `src/worker/*` tsc errors unrelated).
- File sizes: 90 / 180 / 180 LOC — under 200 LOC rule.
- Zero `console.log`, zero AI-attribution, kebab-case names. ✅

---

## Unresolved Questions

1. Should we also wrap `better-stack-client.ts` with the same 2 s timeout in this PR (consistency) or leave as a separate DRY-refactor PR?
2. Should `recordLlmCall` optionally emit a D1 `LLM_SINK_FAILURE` signal when Langfuse is repeatedly unreachable? — current design is silent. Alternative: a Prom-style counter exposed on `/api/metrics` (out of scope for Phase 4D MVP but worth tracking for Phase 4E).
3. Is there an intent to eventually move from one-event-per-step to **batched** Langfuse emission (reduce subrequest count when N workflows fire simultaneously)? The 3.5 MB batch cap allows hundreds per call. Not needed now (Supervisor cron fires ≤ 1/min), but something to plan before GA.
4. Are `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` stored via `wrangler secret put` (matching other secrets) rather than plain `[vars]` in `wrangler.toml`? Secret storage isn't visible in this diff — please verify operator procedure before production rollout.

---

## Ship-it Verdict

**APPROVE with 4 fixes (H1, M3, H2, M2) before production rollout.** Total additional diff ≈ 20 LOC + 1 test. Once applied, score rises to 9.5 / 10.

Sources:
- [Public API - Langfuse](https://langfuse.com/docs/api-and-data-platform/features/public-api)
- [Ingestion API | langfuse/langfuse | DeepWiki](https://deepwiki.com/langfuse/langfuse/6.2-ingestion-api)
- [Langfuse API reference](https://api.reference.langfuse.com/)
