# Phase 31 — Non-`err` Identifier Sweep Wave 5 (`src/app/**` pure-DRY)

**Status:** ✅ COMPLETE (2026-04-24)
**Priority:** P2 (DRY sweep — extends Phase 26→30 series)
**Plan Parent:** `plans/260419-2121-triet-tieu-no-ky-thuat/plan.md`

## Scope

Replace `X instanceof Error ? X.message : String(X)` → `getErrorMessage(X)` across **6 hits in 5 files** under `src/app/**` (pure-DRY subset).

Scope deliberately narrowed to `String(X)` fallback only — domain-specific string literals (`'Sync failed'`, `'Failed to export data'`, `'Failed to extend license'`, `'Internal server error'`) and generic placeholders (`'Unknown error'`) preserved per Phase 30 `anthropic-sse-parser` precedent (semantic intent > DRY).

## Why

Phase 30 closed `src/lib/**` non-`err` sweep. Grep confirms 27 non-`err` residuals in `src/app/**`. Phase 31 takes the 6 `String(X)` pure-DRY hits; remaining 21 (string-literal fallbacks) stay as semantic markers.

## Approach

Per file:
1. Add `import { getErrorMessage } from '@/lib/utils/to-error'` (or extend existing `toError` import).
2. Replace string-extraction ternary → `getErrorMessage(X)`.
3. Preserve adjacent `error instanceof Error ? error : new Error(String(error))` type-guards (Error-returning, not replaceable).

**Exclusions:**
- `'Unknown error'` / domain fallbacks → SEMANTIC (preserve)
- `X instanceof Error ? X : new Error(String(X))` → type-guard (preserve)

## Target Files (5)

| Module | File | Hits |
|--------|------|------|
| admin api | `src/app/api/admin/api-keys/route.ts` | 1 |
| cron | `src/app/api/cron/usage-export/route.ts` | 2 |
| cron | `src/app/api/cron/uptime-check/route.ts` | 1 |
| cron | `src/app/api/cron/error-digest/route.ts` | 1 (`d1Err`) |
| cron | `src/app/api/cron/heartbeat/route.ts` | 1 (`d1Err`) |
| **Total** | **5 files** | **6 hits** |

## Non-Goals

- 21 string-literal fallback residuals in `src/app/**` → PRESERVE (semantic)
- Type-guard ternary → NOT applicable
- `src/app/**` pages/components further audit → Phase 32+

## Success Criteria

- [x] `npm run build` — 0 new TS errors (baseline 611)
- [x] `npm test` — 1321 baseline still green
- [x] `npm run lint` — 0 new warnings on touched files
- [x] 0 `: String(X)` pattern residuals for swept identifiers
- [x] Code review ≥ 9.5/10 APPROVE SHIP
- [x] CI GREEN + Production HTTP 200

## Risk Assessment

- **Risk:** VERY LOW. Pure-DRY mechanical, identical to Phase 27-30.
- **Backward-compat:** N/A (string output identical).
- **Rollback:** single-commit revert.

## Deferred (Phase 32+)

- 21 string-literal fallback residuals (semantic preserve)
- `lib/usage-metering/types.ts` (283L > 200L) modularization
- `ClientWithStorage` → R2 migration
- `raas_licenses` D1-vs-Supabase audit
