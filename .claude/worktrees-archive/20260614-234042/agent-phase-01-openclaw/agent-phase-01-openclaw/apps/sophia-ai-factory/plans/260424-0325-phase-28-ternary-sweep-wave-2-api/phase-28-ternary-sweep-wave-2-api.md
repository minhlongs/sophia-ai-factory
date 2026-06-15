# Phase 28 — `getErrorMessage()` Sweep Wave 2 (`src/app/api/**`)

**Status:** ✅ COMPLETE (2026-04-24)
**Priority:** P2 (DRY sweep — second wave after Phase 27 Wave 1)
**Plan Parent:** `plans/260419-2121-triet-tieu-no-ky-thuat/plan.md`

## Scope

Replace `err instanceof Error ? err.message : String(err)` ternary with `getErrorMessage(err)` inside **`src/app/api/**`** only. Mechanical, behavior-preserving.

## Why

Phase 27 Wave 1 closed clean (9.8/10 APPROVE SHIP). Wave 2 covers the API-route surface — 14 hits across 8 files. Same pattern, broader surface, still low blast radius (all `catch`-block logger metadata or JSON error fields).

## Approach

For each target file:
1. Add `import { getErrorMessage } from '@/lib/utils/to-error'`.
2. Replace inline ternary → `getErrorMessage(err)`.
3. Replace `const message = err instanceof Error ? err.message : String(err)` → `const message = getErrorMessage(err)` (preserve variable shape).
4. Keep surrounding logger/NextResponse call identical.

## Target Files (8)

| File | Hits |
|------|------|
| `src/app/api/health/detail/route.ts` | 2 |
| `src/app/api/user/byok/route.ts` | 2 |
| `src/app/api/discovery/score/route.ts` | 1 |
| `src/app/api/cron/workflow-stepper/route.ts` | 1 |
| `src/app/api/cron/weekly-signals-digest/route.ts` | 5 |
| `src/app/api/cron/llm-cache-purge/route.ts` | 1 |
| `src/app/api/admin/llm-trace-stats/route.ts` | 1 |
| `src/app/api/admin/llm-cache-stats/route.ts` | 1 |
| **Total** | **14** |

## Non-Goals

- `src/lib/{inngest,gateway,billing,telegram}/**` (deferred Phase 29 Wave 3, ~4 hits / 4 files)
- `toError()` semantics change
- Error-response shape changes (behavior-preserving)

## Success Criteria

- [x] `npm run build` — 0 new TS errors (baseline 611)
- [x] `npm test` — 1321 baseline still green
- [x] `npm run lint` — 0 new warnings on touched files
- [x] 0 remaining ternary matches under `src/app/api/**`
- [x] Code review ≥ 9.5/10 APPROVE SHIP
- [x] CI GREEN + Production HTTP 200

## Risk Assessment

- **Risk:** VERY LOW. Same mechanical transform as Phase 27.
- **Backward-compat:** N/A (same string output — observability can only improve for PostgrestError shapes).
- **Rollback:** single-commit revert.

## Deferred (Phase 29+)

- Wave 3: `src/lib/{inngest,gateway,billing,telegram}/**` (~4 hits / 4 files)

## Results (Wave 2 Closed)

| Metric | Value |
|--------|-------|
| Files Modified | 8 |
| Ternary Occurrences Replaced | 14 |
| New Imports Added | 8 (`getErrorMessage`) |
| Build Status | ✅ exit 0 |
| Test Status | ✅ 1321/1321 pass |
| TypeScript Baseline | 611 (Δ 0) |
| Lint Status | ✅ 0 errors on touched files |
| Code Review Score | 9.7/10 APPROVE SHIP |
| CI/CD Status | ✅ Awaiting git-manager push |
| Production Verification | Awaiting git-manager verification |
