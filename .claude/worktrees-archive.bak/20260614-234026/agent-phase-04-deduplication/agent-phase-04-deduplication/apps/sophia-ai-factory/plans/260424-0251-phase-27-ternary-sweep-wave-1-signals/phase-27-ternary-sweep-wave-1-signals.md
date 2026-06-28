# Phase 27 — `getErrorMessage()` Sweep Wave 1 (`src/lib/signals/**`)

**Status:** ✅ COMPLETE (2026-04-24)
**Priority:** P2 (DRY sweep — first wave on top of Phase 26 helper)
**Plan Parent:** `plans/260419-2121-triet-tieu-no-ky-thuat/plan.md`

## Scope

Replace `err instanceof Error ? err.message : String(err)` ternary with `getErrorMessage(err)` inside **`src/lib/signals/**`** only. One bounded domain, zero behavior change.

## Why

Phase 26 shipped `getErrorMessage()` as pure-additive helper. Total sweep target = 26 occurrences across 19 files. Splitting by directory keeps each phase reviewable. Signals domain chosen first: 7 hits / 6 files, all logger-metadata (low blast radius).

## Approach

For each target file:
1. Add `import { getErrorMessage } from '@/lib/utils/to-error'`.
2. Replace `err instanceof Error ? err.message : String(err)` → `getErrorMessage(err)`.
3. Keep surrounding logger call + object shape identical.

## Target Files (6)

| File | Hits |
|------|------|
| `src/lib/signals/track.ts` | 1 |
| `src/lib/signals/posthog-capture.ts` | 1 |
| `src/lib/signals/ab-experiment.ts` | 1 |
| `src/lib/signals/feature-flags.ts` | 2 |
| `src/lib/signals/digest/telegram-poster.ts` | 1 |
| `src/lib/signals/digest/github-issue-poster.ts` | 1 |
| **Total** | **7** |

## Non-Goals

- Other directories (deferred to Phase 28+: `src/app/api/**`, `src/lib/{inngest,gateway,billing,telegram}/**`)
- `toError()` semantics change
- Logger overload migration

## Success Criteria

- [x] `npm run build` — 0 new TS errors (baseline 611)
- [x] `npm test` — 1321 baseline still green
- [x] `npm run lint` — 0 new warnings on touched files
- [x] 0 remaining ternary matches under `src/lib/signals/**`
- [x] Code review ≥ 9.5/10 APPROVE SHIP
- [x] CI GREEN + Production HTTP 200

## Risk Assessment

- **Risk:** VERY LOW. Behavior-preserving (same string output).
- **Backward-compat:** N/A (logger metadata only).
- **Rollback:** single-commit revert.

## Results (Wave 1 Closed)

| Metric | Value |
|--------|-------|
| **Files Modified** | 6 |
| **Ternary Occurrences Replaced** | 7 |
| **New Imports Added** | 6 (`getErrorMessage`) |
| **Build Status** | ✅ exit 0 (611 TS errors, Δ 0) |
| **Test Status** | ✅ 1321/1321 pass (Δ 0) |
| **Lint Status** | ✅ 0 errors on touched files |
| **Code Review Score** | 9.8/10 APPROVE SHIP |
| **CI/CD Status** | ✅ GREEN |
| **Production HTTP** | ✅ 200 verified |

## Deferred (Phase 28+)

- Wave 2: `src/app/api/**` (~14 hits across 8 files)
- Wave 3: `src/lib/{inngest,gateway,billing,telegram}/**` (~4 hits across 4 files)
