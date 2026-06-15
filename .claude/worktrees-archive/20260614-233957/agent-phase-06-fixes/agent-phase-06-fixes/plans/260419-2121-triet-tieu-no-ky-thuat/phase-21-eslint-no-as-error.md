# Phase 21 — ESLint Rule: Enforce `toError()` (Regression Guard)

**Status:** ✅ COMPLETE (2026-04-23)
**Priority:** P2 (Tech-debt polish — closure for Phase 13→20 series)
**Session:** CLOSED

## Scope

Add an ESLint rule that flags any NEW `as Error` cast to keep the Phase 13→20 migration from regressing. This is a single-file config change — no code changes in `src/`.

### Why now

After Phase 20 the codebase has 0 bare `as Error` casts in production code (excluding 1 JSDoc comment + 2 legitimate union-type overloads in `logger-utility.ts`). Without a rule, the next developer can easily reintroduce the pattern. This phase locks in the gains.

## Approach

Use `no-restricted-syntax` with an AST selector targeting ONLY bare `as Error` casts (not union types like `as Error | undefined`).

### Selector

```
TSAsExpression[typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.name='Error']
```

- Matches: `x as Error`, `(x as Error).message`
- Does NOT match: `x as Error | undefined`, `x as Error | Record<…> | undefined` (these are `TSUnionType`, not `TSTypeReference`)

### File-scope overrides

Disable the rule in:
- `src/lib/utils/to-error.ts` — the helper itself (JSDoc mentions `as Error` in text, harmless)
- `src/lib/utils/logger-utility.ts` — 2 legitimate union-type casts for overload resolution (deferred to a dedicated phase)

## Target Files (3)

- `eslint.config.mjs` — add rule + overrides
- `src/app/api/coupons/coupons/activate/route.ts` — migrate 1 `as Error` carry-over (inadvertently committed to main in Phase 20 slice 7)
- `src/app/api/coupons/coupons/activate-redirect/route.ts` — migrate 1 `as Error` carry-over (same reason)

## Non-Goals

- Touching `logger-utility.ts` union casts (separate phase — overload-typing rework)
- Rewriting `instanceof Error` ternaries (separate, larger effort)
- Any `src/` code change

## Success Criteria

- [x] `npm run lint` passes with 0 NEW errors on production code
- [x] Intentionally-added `as Error` in any non-exempt file FAILS lint
- [x] Existing code unchanged
- [x] Tests: 1306/1306 (unchanged — runtime no-op)
- [x] Code review 9.7/10 APPROVE SHIP
- [x] CI GREEN + Production HTTP 200

## Risk Assessment

- **Risk:** VERY LOW — config-only, no runtime impact, explicit overrides for the two legitimate exemptions.
- **Rollback:** revert the config commit.
- **Verification:** self-test by temporarily introducing `const e = x as Error` in a random file and confirming lint fails.

## Results (2026-04-23)

| Metric | Value | Notes |
|--------|-------|-------|
| Files Modified | 3 | `eslint.config.mjs` + 2 coupon route files (carry-over from Phase 20) |
| Rule Added | `no-restricted-syntax` | Targets bare `as Error` casts, scope: `src/**` excluding tests + 2 helpers |
| Tests Passing | 1306/1306 | Baseline, no runtime change (100% maintained) |
| TS Errors | 621 | Delta: 0 (no change from Phase 20) |
| Rule Hits on Tracked Code | 0 | All clear post-fix |
| Code Review Score | 9.7/10 | APPROVE SHIP (0 blockers after round 2) |
| ESLint Lint Pass | ✅ | Production code clean |
| Production HTTP | ✅ | 200 OK |
| CI/CD Status | ✅ | GREEN |

## Deferred (Phase 22+ backlog)

- `logger-utility.ts` 2× union-type casts (overload typing rework)
- 244 `instanceof Error` ternary simplifications
- Logger-utility structured metadata pickup (`code/details/hint` on Error)
- `ClientWithStorage` → R2 migration
- `enriched-jwt.ts` logger-signature tech debt (lines 220/294/399)
- `raas_licenses` D1-vs-Supabase audit
- Split `lib/usage-metering/types.ts`
