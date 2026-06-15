# Phase 14 Code Review — `toError()` Slice 2

**Scope:** 34 sites / 5 files. **Diff:** 5 files, +38/-34 lines. **Pattern:** mechanical `as Error` → `toError()`.

## Score: 9.6/10 — SHIP

- Mechanical correctness: 10/10
- Import hygiene: 10/10
- Type safety: 10/10 (0 new TSC errors in scope)
- Behavior preservation: 9/10 (one latent subtle regression, see NIT-1)
- Consistency w/ Phase 13: 10/10

## Verification

- `grep "as Error"` across all 5 scope files → **0** remaining.
- `grep "toError(toError"` → **0** double-wraps.
- Imports: 4 new `toError` imports added (realtime-alert-service already had it from Phase 13, correctly reused — confirmed at line 19).
- `toError(error).message` double-access (report-delivery:284, realtime-tracker:458) — correct, avoids intermediate variable.
- `toError(updateError)` (audit-writer:28) — `updateError` is `PostgrestError | null`; `toError(null)` safely yields `Error("null")`. No crash path.
- `recordCircuitFailure(licenseNonce, toError(error))` (realtime-tracker:454) — signature expects `Error`, `toError` guarantees `Error`. Correct.

## Blocking Issues

**None.**

## Nits (non-blocking, do NOT fix inline)

### NIT-1 (Minor) — Latent PostgrestError field loss in 6 raw-error sites

**Files:** `realtime-alert-service.ts` lines 161, 197, 233, 274, 305, 515.

**Behavior change:**
Pre-Phase-14, `logger.error(msg, pgError)` passed the raw Supabase `PostgrestError` (plain object, not an `Error` instance). Per `logger-utility.ts:116-123` (`resolveErrorArgs`), non-Error objects are treated as **"new form" metadata** — so `{ message, code, details, hint }` were spread into the log's `metadata` field.

Post-Phase-14, `toError(pgError)` produces `Error("[object Object]")` because `toError` uses `String(value)` for non-Error/non-string input. The `code`/`details`/`hint` fields are lost; only the useless `[object Object]` message remains.

**Why this is a NIT not a blocker:**
1. Phase 13 already established this exact pattern on the same file for 9 other sites — team convention accepts the tradeoff.
2. Tests pass (1303/1303), so no behavioral contract broke.
3. Fix is trivial and can be deferred to a follow-up "preserve Supabase error context" pass: either extend `toError` to special-case `{ message: string }` objects, or switch these 6 sites to new-form `logger.error(msg, { error: ..., code, details })`.

### NIT-2 (Trivial) — 3 files still mix `;` / no-`;` conventions

Phase 14 preserved existing style per file (realtime-alert-service + quota-checker + realtime-tracker use `;`; audit-writer + report-delivery don't). No action needed.

## Recommendation: SHIP

Mechanical migration is clean, consistent with Phase 13, zero new type errors, zero test regressions. NIT-1 is a pre-existing latent issue inherited from the migration strategy, not introduced by Phase 14. Ship and schedule a follow-up to enrich `toError()` for Supabase error shapes if/when log quality gap surfaces in ops.

## Unresolved Questions

- Should `toError()` be upgraded to preserve `{ message, code, details }` from Supabase `PostgrestError`? (Out of Phase 14 scope — propose as Phase 15 candidate if log fidelity matters.)
