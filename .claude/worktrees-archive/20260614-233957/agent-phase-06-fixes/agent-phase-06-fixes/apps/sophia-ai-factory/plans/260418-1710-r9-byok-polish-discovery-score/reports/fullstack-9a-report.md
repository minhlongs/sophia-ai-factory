# Phase 9A — BYOK Admin Polish — Implementation Report

## Files Changed

- `src/middleware.ts` — added `/api/user/byok` to auth rate-limit branch (line 103)
- `src/app/[locale]/dashboard/layout.tsx` — added `KeySquare` import; swapped BYOK icon from `<KeyRound />` to `<KeySquare />`
- `src/app/[locale]/dashboard/byok/loading.tsx` — NEW: 28-LOC skeleton (status banner + list + form placeholders, `animate-pulse`)
- `src/lib/admin/monitoring-queries.ts` — added `ByokEventCounts` interface + `ZERO_BYOK` constant + `aggregateByokEvents(hoursBack=24)` export
- `src/lib/admin/monitoring-queries.test.ts` — added `aggregateByokEvents` import + 7 new test cases

## Test Count Delta

- Before: 17 tests in monitoring-queries.test.ts
- After: 24 tests (+7)
- All 24 pass via `pnpm vitest run`

## Typecheck

- `pnpm tsc --noEmit` — 0 errors in owned files
- Pre-existing errors (not in owned files): middleware.ts:229 (`getAuth()` null), subscription-gate-middleware.ts, telegram-auth-middleware.ts — untouched

## Deliverables Closed

- [x] 9A.1: `/api/user/byok` → `RATE_LIMITS.auth` (stricter than default `RATE_LIMITS.api`); `limit_type` tag remains `'auth'` via existing ternary at line 132
- [x] 9A.2: BYOK sidebar uses `<KeySquare />`, RaaS keeps `<KeyRound />`
- [x] 9A.3: `loading.tsx` exists, server component (no `'use client'`), ~28 LOC, Tailwind animate-pulse skeleton
- [x] 9A.4: `aggregateByokEvents()` queries `signals_events` on `byok_key_set`/`byok_key_cleared`, returns `{setCount, clearCount, netChange}`; 7 tests cover: no-DB, happy path, set-only, clear-only, empty rows, D1 throw, bind arg

## Ownership Boundary

Respected strictly. No edits outside the 5-file ownership list.

## Blockers

None.
