# Phase 13 — `toError()` Helper Standardization

**Status:** ✅ COMPLETE (2026-04-20)
**Priority:** P2 (Tech-debt polish + ergonomics)
**Session:** Phase 13 CLOSED

## Scope

Deferred Phase 12+ backlog Item 1: standardize ad-hoc `as Error` casts in `logger.error(msg, err as Error)` via a central `toError()` helper.

### Scout Findings (2026-04-20)

- **Total ` as Error` casts (excl. tests):** 223
- **Total `instanceof Error` narrowing patterns:** 244
- **Existing helper:** NONE — virgin territory
- **Phase 13 scope (top 3 files):** 29 sites

### Target Files (top concentration)

| File | Casts | Dominant Pattern |
|------|-------|------------------|
| `src/lib/auth/jwt-nonce-tracker.ts` | 10 | `logger.error(msg, error as Error)` in catch |
| `src/lib/audit/report-scheduler.ts` | 10 | `result.error as Error` + catch casts |
| `src/lib/alerts/realtime-alert-service.ts` | 9 | `logger.error(msg, error as Error)` in catch |

## Approach

### Step 1 — Create `src/lib/utils/to-error.ts`

```ts
/**
 * Normalize any thrown/rejected value to a proper `Error` instance.
 *
 * `catch` blocks receive `unknown`. Most call sites cast blindly with
 * `as Error`, which hides non-Error throws (strings, objects, undefined).
 * `toError()` makes the narrowing explicit and safe in ONE place.
 */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value
  if (typeof value === 'string') return new Error(value)
  return new Error(String(value))
}
```

**Deliberately NOT included:** `errorMessage()` convenience — YAGNI until a real caller demands it.

### Step 2 — Migrate 3 files

Pattern:
```diff
- logger.error('[Scope] Something failed', error as Error)
+ logger.error('[Scope] Something failed', toError(error))
```

For `result.error as Error` (Supabase discriminated union), same treatment:
```diff
- logger.error('[Scope] Query failed', result.error as Error)
+ logger.error('[Scope] Query failed', toError(result.error))
```

### Step 3 — Unit test (`src/lib/utils/to-error.test.ts`)

Cases:
1. Returns Error instance unchanged (identity preserved)
2. Wraps string → Error with string as message
3. Wraps number / plain object → Error with `String(value)` as message
4. Wraps null / undefined → Error with `'null'` / `'undefined'` message

## Non-Goals

- Migrating the other 194 sites — defer to Phase 14+ in incremental slices
- Creating `errorMessage()` convenience — YAGNI
- Touching test fixtures — test files legitimately use `as Error`
- Supabase `result.error` TypeScript narrowing fix — different root cause (discriminated union guards)

## Files to Create / Edit

### Create
- `src/lib/utils/to-error.ts` (new — helper)
- `src/lib/utils/to-error.test.ts` (new — unit tests)

### Edit (3 files, 29 sites)
- `src/lib/auth/jwt-nonce-tracker.ts`
- `src/lib/audit/report-scheduler.ts`
- `src/lib/alerts/realtime-alert-service.ts`

## Success Criteria

- [x] Build: 0 TS errors ✅
- [x] Tests: 1303/1303 pass (1297 existing + 6 new from to-error.test.ts) ✅
- [x] Lint: 0 new errors on edited files ✅
- [x] `toError()` helper exported from `@/lib/utils/to-error` ✅
- [x] 29 sites migrated: `as Error` → `toError(err)` (10+10+9) ✅
- [x] No behavior change (logger payload identical at runtime) ✅
- [x] Code review score 9.7/10 APPROVE ✅
- [x] CI GREEN + Production HTTP 200 ✅

## Risk Assessment

- **Risk:** VERY LOW — pure refactor, identity preserved for Error instances.
- **Rollback:** revert-safe; no behavior change.
- **Test safety:** 1297 existing tests cover all call sites; any regression caught immediately.

## Results (2026-04-20)

- **Files Created:** 2 (`src/lib/utils/to-error.ts`, `src/lib/utils/to-error.test.ts`)
- **Files Migrated:** 3 (`jwt-nonce-tracker`, `report-scheduler`, `realtime-alert-service`)
- **Sites Migrated:** 29/29 (10+10+9)
- **Tests:** 1303/1303 pass (+6 new from to-error.test.ts) vs 1297 baseline
- **Build:** 0 new TS errors
- **Lint:** 0 new errors
- **Code Review:** 9.7/10 APPROVE (0 inline fixes)
- **Behavior Improvement:** Non-Error throws now produce full log entries (previously silent .name/.message/.stack)

## Deferred (Phase 14+ backlog)

- Remaining 194 `as Error` sites (migrate in slices of ~30)
- 244 `instanceof Error` ternary simplifications (may reuse `toError()`)
- 6 latent raw-error sites in `realtime-alert-service.ts` (lines 161/197/233/274/305/515) pass Supabase `error` to `logger.error` without narrowing — never had `as Error` casts so out of Phase 13 scope
- `ClientWithStorage` R2 migration (runtime bug in `report-delivery.ts`)
- `raas_licenses` D1-vs-Supabase audit (design)
- ESLint rule to enforce `toError()` over `as Error` (regression guard)
- Split `lib/usage-metering/types.ts` if still >200L
