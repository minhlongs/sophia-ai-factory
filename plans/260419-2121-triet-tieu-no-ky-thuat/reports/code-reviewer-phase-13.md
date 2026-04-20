# Phase 13 Code Review — `toError()` Helper Standardization

**Date:** 2026-04-20
**Reviewer:** code-reviewer
**Scope:** 2 new files + 3 edited files (29 migrations)
**Tests:** 1303/1303 pass | TSC: 0 new | Lint: 0 new

---

## Verdict

**Score: 9.7/10 — APPROVE (auto-threshold 9.5 met, 0 critical, 0 blocking)**

Ship it. Minor nits listed separately; none warrant inline fix before finalize.

---

## Summary

| Area | Score | Notes |
|---|---|---|
| Helper quality | 10/10 | Correct, minimal, safe, identity-preserving |
| Test coverage | 9/10 | 6 cases cover critical surface; 1 nit (see below) |
| Migration consistency | 10/10 | 29/29 sites migrated, 0 remaining `as Error` in scope |
| Naming/export | 10/10 | Matches `logger-utility.ts` / `currency.ts` conventions |
| Import hygiene | 10/10 | `@/lib/utils/to-error` consistent with existing paths |
| YAGNI compliance | 10/10 | `errorMessage()` correctly deferred |
| Future-proofing | 9/10 | Scales to 194 remaining sites; 1 observation (see below) |

---

## Helper Quality (10/10)

`src/lib/utils/to-error.ts` — 12 lines, zero dependencies.

Strengths:
- Identity preserved for `Error` instances (no new allocations, stack trace kept)
- Explicit `typeof 'string'` branch avoids `String(value)` wrapping overhead for the common case
- `String(value)` fallback handles null/undefined/number/object/symbol uniformly
- No `any` types, signature is `(unknown) => Error` — matches Sophia zero-`any` rule
- JSDoc explains the "why" (catch gives `unknown`, callers cast blindly) — excellent

No issues.

## Test Coverage (9/10)

6 cases cover the full decision tree:
1. Error identity preservation ✓
2. String wrapping ✓
3. Number wrapping ✓
4. Plain object wrapping ✓
5. null ✓
6. undefined ✓

**Nit #1 (non-blocking):** Missing `Error` subclass identity test. A `TypeError`/custom `class FooError extends Error` should also pass through unchanged. Current `instanceof Error` check covers this behaviorally, but an explicit test would lock the contract. Not required — YAGNI-consistent to skip.

Deliberately absent (correctly):
- `AggregateError` — works via `instanceof Error` (it is one), no special case needed
- Nested `cause` chain — not in scope; helper preserves `cause` via identity
- Symbol — would go through `String(value)` which throws for symbols, but catch blocks never receive raw symbols from network/DB errors. YAGNI.

## Migration Consistency (10/10)

Verified:
- `jwt-nonce-tracker.ts`: 10 `toError()` calls, 0 remaining `as Error`
- `report-scheduler.ts`: 10 `toError()` calls, 0 remaining `as Error`
- `realtime-alert-service.ts`: 9 `toError()` calls, 0 remaining `as Error`
- Total: **29/29 migrations clean**

Behavior preservation check:
- Previous `err as Error`: runtime cast, zero-cost, logger receives raw value
- New `toError(err)`: runtime type-check + optional wrap, logger receives guaranteed Error
- **Before:** if non-Error thrown (e.g., string rejection), logger tried to read `.name/.message/.stack` → `undefined` → partial log entry
- **After:** non-Error values wrapped into real Error → logger gets full `.name='Error', .message=String(value), .stack=<real trace>`

This is a *strict improvement* — logger entries now populated for previously-silent non-Error throws. No regression possible.

## Future-Proofing (9/10)

**Observation (non-blocking):** In `realtime-alert-service.ts`, 6 `logger.error` sites pass raw Supabase `error` (PostgrestError) without `toError()` wrap — lines 161, 197, 233, 274, 305, 515. These sites **never had `as Error`** so were correctly out of Phase 13 scope, but they are latent bugs (logger receives non-Error → `.name/.message/.stack` undefined). Flag for Phase 14+ backlog.

Helper scales cleanly to the remaining 194 sites — single-line drop-in replacement, no API friction.

## Nits (non-blocking, do NOT fix inline)

1. **Test suite:** consider adding `Error` subclass identity test (TypeError, custom class). ~3 extra lines.
2. **realtime-alert-service.ts lines 161/197/233/274/305/515:** 6 raw Supabase `error` passes to `logger.error` without `toError()` wrap. Out of Phase 13 scope (never had casts) — add to Phase 14+ target.
3. **Semicolon inconsistency:** `to-error.ts` uses no semicolons; `jwt-nonce-tracker.ts`/`realtime-alert-service.ts` use semicolons; `report-scheduler.ts` does not. Matches each file's existing style — no action needed.

## Positive Observations

- JSDoc on helper is short and load-bearing — explains *why* not *what*
- Zero new dependencies, zero new types, zero new concepts introduced
- File size: `to-error.ts` = 12 lines (well under 200-line rule)
- Import path `@/lib/utils/to-error` is grep-friendly and self-documenting
- Tests run under vitest in <1ms — negligible CI cost
- YAGNI enforced: `errorMessage()` rejected per plan — disciplined
- Identity preservation for Error instances = zero perf overhead vs `as Error` in the hot path

## Blocking Issues

None.

## Critical Issues

None.

## Recommended Actions

1. ✅ APPROVE as-is — no inline fixes needed
2. Proceed to Phase 13 finalize (sync plan + docs + commit)
3. Queue the 6 `realtime-alert-service.ts` raw-error sites for Phase 14
4. Consider ESLint rule to enforce `toError()` over `as Error` (already in plan's deferred list)

## Metrics

- Helper LOC: 12
- Test LOC: 43
- Migration sites: 29/29 (100%)
- TS errors: 0 new
- Test count: 1303/1303 (+6 new)
- Remaining `as Error` codebase-wide: 194 (Phase 14+ target)

## Unresolved Questions

None.
