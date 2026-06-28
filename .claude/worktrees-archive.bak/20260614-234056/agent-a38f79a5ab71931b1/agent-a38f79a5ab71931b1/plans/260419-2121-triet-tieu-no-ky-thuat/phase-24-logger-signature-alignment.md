# Phase 24 — Logger `warn`/`info`/`debug` Signature Alignment

**Status:** ✅ COMPLETE (2026-04-23)
**Priority:** P2 (Tech debt closure from Phase 23 deferred list)
**Session:** CLOSED

## Scope

Align `logger.warn`/`logger.info`/`logger.debug` signatures with `logger.error` so they accept an optional `Error` via overload — matching the `resolveErrorArgs` pattern already used by `error()`.

Current gap: `logger.warn/info/debug(message, metadata?, requestId?)` only accepts `Record<string, unknown>` at position 2. Passing `toError(err)` there at 3 call sites in `enriched-jwt.ts` spreads Error object as metadata, losing stack trace when JSON.stringify is called (Error props are non-enumerable).

### Target call sites (3)

- `apps/sophia-ai-factory/src/lib/auth/enriched-jwt.ts:220` — `logger.warn('[Enriched JWT] Failed to fetch Polar billing status', toError(error))`
- `apps/sophia-ai-factory/src/lib/auth/enriched-jwt.ts:294` — `logger.warn('[Enriched JWT] Failed to fetch dunning state', toError(error))`
- `apps/sophia-ai-factory/src/lib/auth/enriched-jwt.ts:399` — `logger.warn('[Enriched JWT] JWT verification failed', toError(error))`

### Why now

Phase 23 closed all `as Error` casts repo-wide. The Phase 23 deferred list explicitly names "enriched-jwt.ts logger-signature tech debt". With only 3 call sites + 1 utility file to touch, this is the smallest closed-scope win before tackling the 244-ternary or larger migrations.

## Approach

1. **Refactor logger-utility** (`src/lib/utils/logger-utility.ts`):
   - Extend `warn`, `info`, `debug` to mirror `error`'s overload:
     - Legacy form: `warn(message, metadata?, requestId?)`
     - New form: `warn(message, error?, metadata?, requestId?)` OR `warn(message, { error?, ...metadata }, requestId?)`
   - Reuse `resolveErrorArgs` helper (already factored).
   - Pass `err` to `log()` so Error `name/message/stack` propagate to structured output.

2. **No call-site changes required** — new signatures accept existing `logger.warn('msg', toError(err))` form correctly.

3. **Add tests** — 3 new cases in `logger-utility.test.ts` covering Error-at-arg2 for `warn`/`info`/`debug`.

## Target Files (2)

- `apps/sophia-ai-factory/src/lib/utils/logger-utility.ts` — extend 3 method overloads
- `apps/sophia-ai-factory/src/lib/utils/logger-utility.test.ts` — add 3 tests (Error preserved on warn/info/debug)

## Non-Goals

- Change call-site semantics (`warn` vs `error`) — scope is signature, not log level choice
- Migrate 244 `instanceof Error` ternaries (separate large phase)
- Split `lib/usage-metering/types.ts` (separate phase)
- Touch `ClientWithStorage` / `raas_licenses` audit (separate phases)

## Success Criteria

- [x] `npm run build` — 0 new TS errors (611 final, Δ -10 improvement from Phase 23 baseline: 621)
- [x] `npm run lint` — 0 rule violations, 0 delta
- [x] `npm test` — 1315/1315 pass (1306 baseline + 9 new tests)
- [x] `logger.warn(msg, errorInstance)` produces structured output with `error.name/message/stack` populated
- [x] Code review 9.7/10 APPROVE SHIP (round 1: BLOCK 6.5/10; round 2: APPROVE after latent bug fix)
- [x] CI GREEN + Production HTTP 200

## Risk Assessment

- **Risk:** LOW. Backward-compat preserved via overload (metadata-form still works). No production runtime-semantics change for existing `logger.warn('msg', { key: value })` calls.
- **Rollback:** revert single refactor commit.
- **Verification:** `tsc --noEmit` must show zero delta; full vitest suite must pass.

## Results

| Metric | Value | Notes |
|--------|-------|-------|
| **Files Modified** | 2 | `logger-utility.ts`, `logger-utility.test.ts` |
| **Call Sites Updated** | 0 | New signature accepts existing form; no site changes needed |
| **TS Errors** | 611 | Δ -10 improvement (621 → 611) |
| **Tests** | 1315/1315 | 1306 baseline + 9 new (3 Phase 24 `warn/info/debug` + 6 metadata forms) |
| **Lint Violations** | 0 | No delta; all rules clean |
| **Code Review** | 9.7/10 APPROVE SHIP | Round 1: BLOCK 6.5/10 flagged silent-drop on non-Error string `{ error: 'msg' }`; Round 2: APPROVE after fix to preserve record when `record.error` is non-Error |

### Incidental Fix (Round 1 Blocker)

Phase 24 review uncovered latent bug in `resolveErrorArgs`: string-valued `{ error: 'msg' }` at ~10 call sites was silently dropped. Added lines 126–128 to preserve record as metadata when `record.error` is not Error instance. Blocks phase 24 from breaking existing call patterns + provides foundation for 244 ternary simplification phase.

## Deferred (Phase 25+ backlog)

- 244 `instanceof Error` ternary simplifications
- `ClientWithStorage` → R2 migration
- `raas_licenses` D1-vs-Supabase audit
- Split `lib/usage-metering/types.ts` if >200L
- Logger-utility structured metadata pickup for `code/details/hint` on Error
