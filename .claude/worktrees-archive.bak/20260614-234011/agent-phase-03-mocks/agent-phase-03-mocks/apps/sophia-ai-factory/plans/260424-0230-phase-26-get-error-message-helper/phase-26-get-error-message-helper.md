# Phase 26 — `getErrorMessage()` Helper Introduction

**Status:** ✅ COMPLETE (2026-04-24)
**Priority:** P2 (foundational — enables Phase 27+ ternary DRY sweep)
**Plan Parent:** `plans/260419-2121-triet-tieu-no-ky-thuat/plan.md`

## Scope

Introduce `getErrorMessage(value: unknown): string` helper alongside existing `toError()`. Pure additive — no call-site changes.

## Why

Codebase has ~47+ occurrences of `err instanceof Error ? err.message : String(err)` across ~34 files. That ternary is:
- DRY violation (same 3-branch pattern repeated)
- Fragile (misses PostgrestError own-message objects — falls through to `String(err)` → `"[object Object]"`)
- Verbose at call-sites

Phase 15 gave us `toError()`. Phase 24/25 gave us logger overloads that accept Error. But for flows that only need the **string message** (e.g., building user-facing error responses, logging as metadata string), there's no one-liner.

`getErrorMessage(value)` = `toError(value).message`. One line, correct PostgrestError handling for free.

## Approach

1. Add `export function getErrorMessage(value: unknown): string` in `to-error.ts` — delegates to `toError()`.
2. Add 3 vitest cases to `to-error.test.ts`:
   - Error → returns `.message`
   - String → returns the string
   - PostgrestError-shaped → returns `.message` (not `"[object Object]"`)

## Non-Goals

- Migrate any existing ternary call-site (Phase 27+ sweep)
- Change `toError()` semantics
- Introduce separate error-utils file (KISS — co-locate)

## Target Files (2)

- `apps/sophia-ai-factory/src/lib/utils/to-error.ts` — +1 export (~5 lines)
- `apps/sophia-ai-factory/src/lib/utils/to-error.test.ts` — +3 tests

## Success Criteria

- [x] `npm run build` — 0 new TS errors
- [x] `npm test` — previous baseline + 3 new tests pass
- [x] `getErrorMessage(new Error("x"))` → `"x"`
- [x] `getErrorMessage("x")` → `"x"`
- [x] `getErrorMessage({ message: "db down", code: "42P01" })` → `"db down"` (not `"[object Object]"`)
- [x] Code review ≥ 9.5/10 APPROVE SHIP (auto-mode threshold)
- [x] CI GREEN + Production HTTP 200

## Risk Assessment

- **Risk:** VERY LOW. Pure additive export, zero consumer today.
- **Backward-compat:** N/A (new function).
- **Rollback:** single-commit revert.

## Results

| Metric | Value |
|--------|-------|
| Files Modified | 2 |
| LOC Added | ~6 |
| Tests Added | 3 |
| Tests Passing | 1321/1321 |
| TypeScript Errors | 611 (Δ 0) |
| Review Score | 9.8/10 |
| Critical/High Issues | 0 |

**Summary:** Added `getErrorMessage(value: unknown): string` export in `to-error.ts` + 3 vitest cases. Pure additive, zero call-site migration. Foundational for Phase 27+ ternary DRY sweep.

## Deferred (Phase 27+)

- Sweep ~47 `err instanceof Error ? err.message : String(err)` ternaries → `getErrorMessage(err)`.
- `ClientWithStorage` → R2 migration.
- `raas_licenses` D1-vs-Supabase audit.
- Split `lib/usage-metering/types.ts` (283L > 200L) if friction emerges.
