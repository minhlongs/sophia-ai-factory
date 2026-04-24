# Phase 23 — Scripts + Test-File `as Error` Closure

**Status:** ✅ COMPLETE (2026-04-23)
**Priority:** P2 (Repo-wide closure of Phase 13→22 series)
**Session:** CLOSED

## Scope

Remove the 4 remaining `as Error` casts that live outside `src/` production code and outside the ESLint guard scope:

- `apps/sophia-ai-factory/scripts/production-setup.ts` — 3 sites at lines 188, 238, 304
- `apps/sophia-ai-factory/src/lib/ai/anthropic-adapter.test.ts` — 1 site at line 496

After this phase, the entire repository (production + scripts + tests) is free of bare `as Error` casts.

### Why now

Phase 22 closed the last production casts in `src/`. These 4 remaining sites are:
- **Scripts**: CLI setup wizard — not deployed to Workers, but still part of codebase quality.
- **Test file**: exempted from ESLint rule (tests pattern) but still uses unsafe cast.

All use the same pattern: `(error as Error).message` in `catch (error) { ... }` blocks where `error` is `unknown`. A non-Error throw would produce `undefined.message` runtime TypeError — low likelihood but latent.

## Approach

1. **Scripts** (3 sites): Use inline fallback `error instanceof Error ? error.message : String(error)`. Avoid importing `toError` from `src/` into a standalone script to keep script self-contained (KISS, avoid tsconfig alias risk for non-Next.js builds).
2. **Test file** (1 site): Import `toError` from `@/lib/utils/to-error` and replace with `toError(err).message`.
3. Verify build (TS compiles), lint (0 delta), tests (1306/1306 baseline).

## Target Files (2)

- `apps/sophia-ai-factory/scripts/production-setup.ts` — 3 inline ternary replacements
- `apps/sophia-ai-factory/src/lib/ai/anthropic-adapter.test.ts` — 1 `toError()` replacement + import

## Non-Goals

- Expand ESLint rule to scripts/ or tests/ (scope creep — current rule is production-only by design)
- Logger signature refactor (enriched-jwt.ts deferred)
- `instanceof Error` ternary simplifications (separate large phase)

## Success Criteria

- [x] `npm run build` passes (TS error count unchanged from Phase 22 baseline: 621)
- [x] `npm run lint` passes (0 rule violations, 0 delta)
- [x] `npm test` → 1306/1306 pass
- [x] `grep -r "as Error" apps/sophia-ai-factory/` returns only `to-error.ts` JSDoc + `to-error.test.ts` + ESLint config comments + changelog mentions
- [x] Code review ≥ 9.5/10 APPROVE SHIP
- [x] CI GREEN + Production HTTP 200

## Risk Assessment

- **Risk:** VERY LOW. Scripts only run manually on CLI; test file is exercised by vitest. Both preserve the `.message` extraction path. Non-Error throws now produce readable string instead of `undefined`.
- **Rollback:** revert commit (single refactor commit).
- **Verification:** `tsc --noEmit` must show zero delta from Phase 22 baseline (621 errors).

## Results (2026-04-23)

| Metric | Value | Notes |
|--------|-------|-------|
| Files Modified | 2 | `apps/sophia-ai-factory/scripts/production-setup.ts` + `src/lib/ai/anthropic-adapter.test.ts` |
| Casts Removed | 4 | 3 inline ternary in scripts/production-setup.ts (lines 188, 238, 304) + 1 toError() in test file (line 496) |
| Scripts Strategy | inline ternary | `error instanceof Error ? error.message : String(error)` (self-contained, no import) |
| Test Strategy | toError() helper | Imported from `@/lib/utils/to-error`, replaces cast + provides full error handling |
| Tests Passing | 1306/1306 | Baseline, no runtime change (100% maintained) |
| TS Errors | 621 | Delta: 0 (no change from Phase 22) |
| Lint Rule Hits | 0 | All clear; `no-restricted-syntax` fires 0× across entire repo |
| Code Review Score | 9.7/10 | APPROVE SHIP (clean patterns; predictable behavior) |
| CI/CD Status | ✅ | GREEN |
| Production HTTP | ✅ | 200 OK |
| Cumulative (Phase 13→23) | 233 `as Error` | All normalized; 0 bare `as Error` casts remain repo-wide (production + scripts + tests) |

## Deferred (Phase 24+ backlog)

- 244 `instanceof Error` ternary simplifications
- `enriched-jwt.ts` logger-signature tech debt
- Logger-utility structured metadata
- `ClientWithStorage` → R2 migration
- `raas_licenses` D1-vs-Supabase audit
- Split `lib/usage-metering/types.ts` if >200L
