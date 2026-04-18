# Sophia R5 — Phase 4N: SSE tool-use streaming + 4L follow-ups

**Status:** in progress
**Mode:** `/cook all step by step --auto` (R5 item 1/5)
**Origin:** Phase 4L M-1/M-2/L-1/L-2/L-3 non-blocking findings + PDF "chat UX needs tool-use"

## Goal

Extend `callAnthropicStream` to yield structured events (text + tool-use) so chat UX (4L-next) can:
- Accumulate partial `input_json_delta` for tool-use input
- Detect `message_delta.stop_reason` terminators
- Distinguish text chunks vs tool-use blocks

## Scope

### New file
- `src/lib/ai/anthropic-sse-parser.ts` — pure SSE parser
  - `AnthropicStreamEvent` discriminated union (7 variants)
  - `parseAnthropicSse(reader, decoder?)` async generator

### Modified files
- `src/lib/ai/anthropic-adapter.ts`
  - **New export** `callAnthropicStreamEvents(params): AsyncGenerator<AnthropicStreamEvent>`
  - **Refactor** `callAnthropicStream` → delegates to events generator, filters text_delta
  - **Fix L-1** `httpError` truncates body to 500 chars
  - Re-export `AnthropicStreamEvent` type
  - Remove inline `SseDeltaEvent` interface (moved to parser)

- `src/lib/ai/anthropic-adapter.test.ts` (+~6 tests)
  - Events: emits full tool_use flow (content_block_start → input_json_delta → stop)
  - Events: emits `message_delta.stop_reason`
  - httpError body truncation (L-1)
  - Chunk boundary mid-event split (L-3)

## File ownership
Disjoint — no overlap with any other Sophia subsystem.

## Non-goals
- No chat UX wiring (deferred to 4L-next, task #62)
- No tool-call execution loop (caller's responsibility)
- No `callAnthropicFull`-side tool-use changes (already works)

## Verification
- Build `npm run build` → 0 errors
- Tests `npm test` → 1220 → 1226+ (+6)
- Existing 4L stream tests pass unchanged (backward compat)
- File sizes: adapter ≤200 LOC, parser ≤100 LOC

## Rule #0 (post-push)
- CI ✅ green
- Deploy ✅
- Prod HTTP 200 + shortSha match
