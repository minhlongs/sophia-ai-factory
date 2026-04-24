# Phase 22 — Logger-Utility `as Error` Closure

**Status:** ✅ COMPLETE (2026-04-23)
**Priority:** P2 (Final closure of Phase 13→21 series)
**Session:** CLOSED

## Scope

Eliminate the last 2 `as Error` union casts in `src/lib/utils/logger-utility.ts`, then remove the file-scope ESLint exemption. This is the final closure of the Phase 13→21 `toError()` migration series.

### Why now

After Phase 21's ESLint regression guard, the only remaining `as Error` casts in `src/` are 2 union-type casts in `logger-utility.ts` — both **redundant**. TypeScript narrowing already handles them:

- **Line 125** (`return { err: arg2 as Error | undefined, ... }`) — inside the legacy branch where `arg2 !== undefined && !(arg2 instanceof Error)` has FAILED, compiler narrows `arg2` to `Error | undefined` automatically.
- **Line 156** (`arg2 as Error | Record<string, unknown> | undefined`) — parameter type of `resolveErrorArgs` is already `Error | Record<string, unknown> | undefined`; `arg2` in caller has effective type `Error | Record<string, unknown> | undefined` (from optional `?`). Types match exactly.

## Approach

1. Delete both casts (pure tech-debt removal — no logic change).
2. Remove `src/lib/utils/logger-utility.ts` from the `ignores` list in `eslint.config.mjs` — no longer needed since bare `as Error` never existed here and union casts are gone.
3. Verify build (TS compiles), lint (regression rule doesn't fire in this file anymore), tests (1306/1306 baseline).

## Target Files (2)

- `apps/sophia-ai-factory/src/lib/utils/logger-utility.ts` — remove 2 casts
- `apps/sophia-ai-factory/eslint.config.mjs` — drop 1 ignore entry

## Non-Goals

- Logger signature refactor (enriched-jwt.ts deferred)
- Structured metadata pickup on Error (`code/details/hint`)
- `instanceof Error` ternary simplifications

## Success Criteria

- [ ] `npm run build` passes (TS error count unchanged from Phase 21)
- [ ] `npm run lint` passes (0 rule violations in `logger-utility.ts`)
- [ ] `npm test` → 1306/1306 pass
- [ ] Code review ≥ 9.5/10 APPROVE SHIP
- [ ] CI GREEN + Production HTTP 200

## Risk Assessment

- **Risk:** VERY LOW. Redundant casts — removing them changes nothing at runtime, and TypeScript will catch any type mismatch at build time.
- **Rollback:** revert commit (single refactor commit).
- **Verification:** `tsc --noEmit` must show zero delta from Phase 21 baseline (621 errors).

## Results (2026-04-23)

| Metric | Value | Notes |
|--------|-------|-------|
| Files Modified | 2 | `src/lib/utils/logger-utility.ts` + `eslint.config.mjs` |
| Casts Removed | 2 | Union-type `as Error \| ...` at lines 125 & 156 (redundant; TS narrowing handles both) |
| ESLint Ignore Drops | 1 | Removed `src/lib/utils/logger-utility.ts` from ignores list (no longer needed) |
| Regression Rule Updated | ✅ | Header comment bumped "Phase 13→20" → "Phase 13→22" |
| Tests Passing | 1306/1306 | Baseline, no runtime change (100% maintained) |
| TS Errors | 621 | Delta: 0 (no change from Phase 21) |
| Lint Rule Hits | 0 | All clear; `no-restricted-syntax` fires 0× across `src/` tree |
| Code Review Score | 10/10 | APPROVE SHIP (0 blockers) |
| CI/CD Status | ✅ | GREEN |
| Production HTTP | ✅ | 200 OK |
| Cumulative (Phase 13→22) | 229 `as Error` | All normalized; 0 bare casts remain in production code |

## Deferred (Phase 23+ backlog)

- 244 `instanceof Error` ternary simplifications
- `enriched-jwt.ts` logger-signature tech debt (lines 220/294/399)
- Logger-utility structured metadata (`code/details/hint` on Error)
- `scripts/production-setup.ts` 3 cast sites (outside `src/`)
- 1 test-file cast in `src/lib/ai/anthropic-adapter.test.ts`
- `ClientWithStorage` → R2 migration
- `raas_licenses` D1-vs-Supabase audit
- Split `lib/usage-metering/types.ts` if >200L
