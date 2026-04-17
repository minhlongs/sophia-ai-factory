# Phase 5 — BYOK Timeout Guard Wrapper

## Context Links
- BYOK adapters (scattered, no central dir):
  - `apps/sophia-ai-factory/src/lib/ai/text-to-speech-generator-elevenlabs.ts`
  - `apps/sophia-ai-factory/src/lib/discovery/affiliate-openrouter-niche-enhancer.ts`
  - (D-ID adapter — search at impl time: `grep -rn "d-id\|D-ID\|did.com" apps/sophia-ai-factory/src`)
- Phase 1 deliverable: `track()` helper for emitting `byok_timeout`
- Reports: `plans/reports/researcher-260417-1011-ai-video-repos-comparison.md` §"A1 timeout guard"

## Overview
- **Priority:** P2
- **Status:** pending
- **Owner:** dev-D (fullstack-developer)
- **Effort:** 2h
- Defensive wrapper preventing silent 30s edge-runtime kills on long BYOK calls. Default 25s timeout. Emits `byok_timeout` signal for ops visibility.

## Key Insights
- Sophia has NO `src/lib/byok/` dir today. **Create it** as the canonical home for shared BYOK helpers (this wrapper is the seed).
- Existing adapters call `fetch()` directly. Wrap their fetch calls in-place — DO NOT refactor adapter architecture.
- Default 25s leaves 5s headroom under 30s edge limit for response handling + signal emission.
- AbortController is edge-safe (Workers spec compliant).
- Timeout event MUST be emitted (Phase 1 `track()`) regardless of caller behavior — wrapper handles it internally.

## Requirements

### Functional
- `withTimeout(input: RequestInfo, init?: RequestInit & { timeoutMs?: number; provider: string }): Promise<Response>` — drop-in replacement for `fetch()`.
- On timeout: aborts request, emits `track('byok_timeout', 'system', { provider, timeout_ms, url_host })`, throws `BYOKTimeoutError`.
- On success: passes Response through unchanged.
- On non-timeout error (network, 5xx): emits `track('byok_call', …, { provider, status: 'error' })` and re-throws original.
- On success: emits `track('byok_call', …, { provider, status_code, latency_ms })`.

### Non-Functional
- Edge runtime; uses `globalThis.AbortController` (no polyfill).
- Default `timeoutMs` = 25_000.
- `BYOKTimeoutError` extends `Error` with `name='BYOKTimeoutError'`, `provider`, `timeoutMs` fields.
- Zero `:any`. JSDoc on public API.

## Architecture
```ts
// src/lib/byok/with-timeout.ts
import { track } from '@/lib/signals/track'

export class BYOKTimeoutError extends Error {
  constructor(public provider: string, public timeoutMs: number) {
    super(`BYOK ${provider} timed out after ${timeoutMs}ms`)
    this.name = 'BYOKTimeoutError'
  }
}

interface WithTimeoutInit extends RequestInit {
  timeoutMs?: number
  provider: string
}

export async function withTimeout(
  input: RequestInfo,
  init: WithTimeoutInit,
): Promise<Response> {
  const { timeoutMs = 25_000, provider, ...rest } = init
  const controller = new AbortController()
  const t0 = Date.now()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(input, { ...rest, signal: controller.signal })
    track('byok_call', 'system', {
      provider,
      status_code: res.status,
      latency_ms: Date.now() - t0,
    })
    return res
  } catch (err) {
    if (controller.signal.aborted) {
      track('byok_timeout', 'system', {
        provider,
        timeout_ms: timeoutMs,
        url_host: typeof input === 'string' ? new URL(input).host : 'unknown',
      })
      throw new BYOKTimeoutError(provider, timeoutMs)
    }
    track('byok_call', 'system', { provider, status: 'error', latency_ms: Date.now() - t0 })
    throw err
  } finally {
    clearTimeout(timer)
  }
}
```

## Related Code Files

### Create
- `apps/sophia-ai-factory/src/lib/byok/with-timeout.ts` — wrapper + error class
- `apps/sophia-ai-factory/src/lib/byok/with-timeout.test.ts` — ≥4 tests:
  - happy path (resolves before timeout)
  - timeout fires AbortController + throws BYOKTimeoutError
  - non-timeout error re-thrown
  - `track` called w/ correct event for each path (mock track)

### Modify (apply wrapper to existing adapters — surgical replacements)
- `apps/sophia-ai-factory/src/lib/ai/text-to-speech-generator-elevenlabs.ts` — replace `fetch(elevenlabsUrl, …)` w/ `withTimeout(elevenlabsUrl, { ...init, provider: 'elevenlabs' })`
- `apps/sophia-ai-factory/src/lib/discovery/affiliate-openrouter-niche-enhancer.ts` — same pattern, `provider: 'openrouter'`
- D-ID adapter (locate via grep) — same pattern, `provider: 'd-id'`

### Delete
- none

## Implementation Steps
1. Create `src/lib/byok/with-timeout.ts` per Architecture spec.
2. Create `src/lib/byok/with-timeout.test.ts` w/ ≥4 cases (use `vi.mock('@/lib/signals/track')` to verify track invocations).
3. Locate D-ID adapter: `grep -rn "d-id\|D-ID\|api.d-id" apps/sophia-ai-factory/src`.
4. Apply wrapper to ElevenLabs adapter (1 fetch call site).
5. Apply wrapper to OpenRouter adapter.
6. Apply wrapper to D-ID adapter (if found; else flag in PR).
7. Run `npm run build` — verify no TS errors from new types.
8. Run `npm test` — all green; add adapter-specific tests if existing tests don't cover these branches.
9. Smoke test: artificially set `timeoutMs: 1` in a test → verify `byok_timeout` event row in local D1 (cross-phase verification w/ Phase 1).

## File Ownership (Parallel Mode)
- **Owns exclusively:** `apps/sophia-ai-factory/src/lib/byok/` (entire new dir) + the 3 BYOK adapter files listed.
- **Coordination point with Phase 1:** Phase 1 owns `track()` and the `byok_call` instrumentation INSIDE adapters. Phase 5 wraps the `fetch` call. Resolution:
  - Phase 1 lands FIRST (creates `track()` + emits `byok_call` from adapter).
  - Phase 5 then REPLACES the bare `fetch` w/ `withTimeout`, which emits `byok_call` internally — Phase 5 REMOVES the duplicate `track('byok_call', …)` line that Phase 1 added to adapters.
  - Net result: single `byok_call` emission per call, from `withTimeout`.
  - Coordination via comments in PRs + sequential merge (Phase 1 → Phase 5).

## Dependencies
- **Blocks:** none
- **Blocked by:** Phase 0; SOFT-blocked by Phase 1 (needs `track()` import — can stub if Phase 1 not yet merged, but prefer sequential merge).

## Todo List
- [ ] Create `src/lib/byok/with-timeout.ts`
- [ ] Create `BYOKTimeoutError` class
- [ ] Create `with-timeout.test.ts` (≥4 cases)
- [ ] Apply to ElevenLabs adapter
- [ ] Apply to OpenRouter adapter
- [ ] Locate + apply to D-ID adapter (or flag missing)
- [ ] Remove duplicate `track('byok_call', …)` lines from adapters (post Phase 1 merge)
- [ ] `npm run build` 0 errors
- [ ] `npm test` all pass
- [ ] Smoke test timeout signal in local D1

## Success Criteria
- All BYOK external calls go through `withTimeout`.
- Forced timeout (e.g., `setTimeout(() => abort(), 1)`) → `BYOKTimeoutError` thrown + `byok_timeout` row in `signals_events`.
- No silent 30s kills in prod logs after deploy (verify 1 week post-merge).

## Risk Assessment
- **R1:** Adapter callers don't catch `BYOKTimeoutError` → uncaught rejection. Mitigation: each adapter's existing try/catch already catches generic `Error`; new error subclass inherits, no breakage.
- **R2:** 25s too short for legitimate long video calls → make `timeoutMs` per-adapter overridable (already in API).
- **R3:** Phase 1 not yet merged → import path missing. Mitigation: sequential merge order documented in plan.md + PR description cross-links.

## Security Considerations
- Wrapper does not log request body or auth headers — `track` props limited to `provider, status_code, latency_ms, url_host` (no key material).
- Timeout abort cancels in-flight upstream request — no resource leak.

## Next Steps
- After 1 week prod data: tune `timeoutMs` per provider based on `byok_call` latency_ms p95.
- Consider adding retry-on-timeout (1 retry max) — defer to next iteration (YAGNI).
