# Code Review — Phase 4N SSE Tool-Use Streaming

**Date:** 2026-04-18 11:25
**Reviewer:** code-reviewer (Sophia R5 item 1/5)
**Plan:** `plans/260418-2345-sophia-r5-4n/plan.md`
**Score:** **9.7/10 — SHIP** (0 critical, 0 high)

---

## Scope

- `src/lib/ai/anthropic-sse-parser.ts` (NEW, 128 LOC)
- `src/lib/ai/anthropic-adapter.ts` (175 LOC, was 188)
- `src/lib/ai/anthropic-adapter.test.ts` (466 LOC, +~130 +6 tests)
- Plan closes 4L L-1 / L-2 / L-3; M-1 / M-2 still deferred per plan

---

## Verification (re-ran locally)

| Check                 | Result                                                     |
|-----------------------|------------------------------------------------------------|
| `wc -l` parser        | **128** ≤ 200 ✅                                           |
| `wc -l` adapter       | **175** ≤ 200 ✅                                           |
| `vitest` adapter file | **19/19 pass** (12ms) ✅                                   |
| Backward compat       | Only 1 real caller (`cron/workflow-stepper/route.ts` uses `callAnthropic`) — untouched path ✅ |
| Re-export surface     | `AnthropicStreamEvent` re-exported at line 19, consumable from `anthropic-adapter` ✅ |
| apiKey leak audit     | `x-api-key` only sent in request headers; `httpError` echoes only `response.text()` body → no leak ✅ |

---

## Overall Assessment

Clean, well-factored refactor. The SSE parser is a pure generator (no fetch / no state outside the local buffer), which makes it trivially testable and reusable. The adapter is now a thin HTTP layer + two thin wrappers — classic composition. `callAnthropicStream` becoming a 2-line filter over `callAnthropicStreamEvents` is exactly the DRY win the plan promised. 4L L-1/L-2/L-3 are all closed with tests. YAGNI respected — no `ping`, no `error`, no `content_block_delta.thinking_delta` speculation.

---

## Critical Issues

**None.**

---

## High Priority

**None.**

---

## Medium Priority

**M-1 (carry-over from 4L, not introduced here but worth flagging):** `parseAnthropicSse` still uses `indexOf('\n')` rather than SSE-spec `\r\n` / `\r` handling. Anthropic servers emit `\n` per observed traffic, and the chunk-boundary test proves robustness for that line-ending, but a proxy or CDN buffer could in theory normalize to CRLF. Low probability, explicitly out of 4N scope — leave as deferred.

**M-2 (new, minor):** `parseAnthropicSse` silently swallows JSON parse errors (`catch { return }`, parser L105–106). For production observability, consider yielding a synthetic `{ type: 'parse_error', raw: string }` variant — caller can decide to log vs ignore. However, the current behavior matches Anthropic's own SSE robustness guidance ("clients SHOULD skip unknown events"), so not a blocker. Defer to 4L-next if chat UX needs it.

---

## Low Priority

**L-1:** `mapEvent` casts `raw.content_block.type as 'text' | 'tool_use'` (parser L52) without validation. If Anthropic ever adds a new block type (e.g. `thinking`, `server_tool_use`), this becomes a silent lie to TS. Fix: narrow via explicit check, return `null` for unknown. 3-line change, can wait.

```ts
// Suggested:
const blockType = raw.content_block.type
if (blockType !== 'text' && blockType !== 'tool_use') return null
return { type: 'content_block_start', index: raw.index, block: { type: blockType, ... } }
```

**L-2:** Parser `tryEmit` is declared as `function*` inside the async generator (L99). Works, but re-creates the inner generator each outer iteration. Minor; V8 should optimize. Could lift to module scope for clarity, but DRY/KISS argues current colocated placement is fine.

**L-3:** Test file at 466 LOC. Still under the 200-line file-size rule? **No — test files are explicitly listed as "not to modularize" in `binh-phap-*` / development rules, and test files commonly exceed the guideline.** Not a violation; documenting for completeness.

**L-4:** `makeSseStream` helper is duplicated inside `callAnthropicStream` describe (L236) and at module level for `callAnthropicStreamEvents` (L338). DRY nit — extract to shared `function` at top. 5 lines saved. Optional.

**L-5:** TS strictness — `RawSseEvent` uses loose optional fields (parser L27-39). Acceptable for external-wire shape, but `as RawSseEvent` cast on `JSON.parse` (L105) bypasses runtime validation. Given `mapEvent` returns `null` for missing fields, this is safe in practice. Consider `zod` if Anthropic schema drifts become a concern — overkill today.

---

## Edge Cases Scouted (not covered)

1. **Reader throws mid-stream** — `parseAnthropicSse`'s `reader.read()` rejection propagates up the async generator. Caller's `for await` will throw. Current behavior is correct; no explicit test. Minor test-debt.
2. **Multiple `content_block` concurrent indices** — Anthropic supports interleaved blocks (e.g. index 0 text while index 1 tool_use). Parser passes `index` through untouched, so caller can disambiguate. ✅ Correct by design; no test but trivially verifiable from existing tool_use test.
3. **Bare `\r\n` line endings** — Not tested, see M-1 above.
4. **Empty `partial_json` delta** — `typeof raw.delta.partial_json === 'string'` accepts `''`. Caller concatenates → no-op. Safe. ✅
5. **`content_block_start` with type=`tool_use` but missing `id` or `name`** — Parser passes through undefined. Block typed as `AnthropicContentBlockMeta` with optional `id/name`. Caller must handle. ✅ Matches Anthropic spec (server always sends both).
6. **Very long `response.text()` on non-ok** — Truncated to 500 chars; test covers this. ✅ No DoS vector.

---

## Security Audit

- ✅ **apiKey** never flows into error messages (headers-only; `httpError` only reads response body).
- ✅ **Body truncation** (500 chars) bounds memory + log-volume from malicious upstream responses.
- ✅ **No `eval` / no `Function` constructor / no dynamic imports**.
- ✅ **Prototype pollution** — `JSON.parse` of untrusted body is cast via `as RawSseEvent`; fields are read-only accessors, never assigned back to globals.
- ⚠️ **Streaming cancellation** — `callAnthropicStreamEvents` does not call `reader.releaseLock()` / `reader.cancel()` on early `break` from the outer `for await`. If consumer abandons the stream, the TCP connection lingers until GC. Low impact (Workers edge isolates have short lifetimes), but consider `try { ... } finally { reader.cancel().catch(() => {}) }` for 4L-next chat UX. **Flag as L-6.**

---

## Backward Compatibility

- `callAnthropic` signature unchanged → `cron/workflow-stepper/route.ts` untouched.
- `callAnthropicStream` signature unchanged (still `AsyncGenerator<string>`). Internally re-implemented as filter over events generator — **no behavioral difference observed**; all 4 existing 4L stream tests still green.
- `callAnthropicFull` signature unchanged.
- **New export** `callAnthropicStreamEvents` — additive, no risk.
- **New re-exported type** `AnthropicStreamEvent` — additive.

✅ Zero breaking changes.

---

## Positive Observations

1. **Discriminated union done right** — `AnthropicStreamEvent` uses `type` literal discriminant, TS narrows cleanly (test L390 uses `Extract<..., { type: 'input_json_delta' }>` with no casts).
2. **Parser is pure** — only the `reader` is side-effectful input; no globals, no fetch, no logging. Perfect testability.
3. **Chunk-boundary test (L-3)** is genuinely split mid-JSON (`"content_bl|ock_delta"`), not just a trivial 2-chunk case. Exercises the real edge.
4. **Final-flush on stream close** (parser L124-127) catches Anthropic's occasional `data: [DONE]` without trailing `\n\n` — a subtle correctness win.
5. **`httpError` truncation** preserves prefix (human-readable) + appends `...[truncated]` marker so logs are never ambiguous about whether full body was received.
6. **File-size discipline** — adapter went 188→175 (dropped inline `SseDeltaEvent`), parser 128, both within 200-LOC rule. Modularization worked.
7. **Test naming** — each `it()` label explicitly names the fix ID (L-1, L-2, L-3), making the causal chain from finding → fix → test trivial to audit.

---

## Recommended Actions

**Before ship:** None blocking. Score gates 9.5+ → SHIP.

**Defer to 4L-next (chat UX):**
1. L-1 parser: narrow `content_block.type` instead of casting (3 LOC).
2. L-6 security: `reader.cancel()` on early-exit in `callAnthropicStreamEvents` (finally block).
3. M-2 parser: consider `{ type: 'parse_error' }` synthetic event for observability.
4. L-4 test: deduplicate `makeSseStream` helper.

---

## Metrics

| Metric                  | Value         |
|-------------------------|---------------|
| Type Coverage           | 100% (0 `:any`) |
| Tests added             | +6 (1220 → 1226 claimed; 19/19 in adapter file verified locally) |
| Adapter LOC delta       | 188 → 175 (−13) |
| New parser LOC          | 128           |
| Linting issues          | 0 observed    |
| Critical / High / Med / Low | 0 / 0 / 2 / 6 |

---

## Score: **9.7 / 10 — SHIP**

Auto-approve threshold (9.5) cleared. Recommend merge + proceed to R5 item 2/5.

---

## Unresolved Questions

1. Should `parseAnthropicSse` emit synthetic `parse_error` events for observability (M-2)? — defer to chat-UX requirements in 4L-next.
2. Is `\r\n` / `\r` line-ending robustness (M-1 carry-over) required before chat UX goes live? — depends on whether Cloudflare Workers edge inserts any intermediary buffering. Test against real prod SSE before 4G-PROD flip.
3. L-6 stream cancellation — block on 4L-next chat UX, or close now with a 3-line `try/finally`?
