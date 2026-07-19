# TIER-2A Implementation Report

## Status: COMPLETED

## Errors fixed: 34 → 0

---

## Fixes Applied (by category)

### A) User type mismatches (10 errors)
- `src/app/api/scripts/generate/route.test.ts`: `avatar_url: null` → `undefined`
- `src/app/api/videos/[id]/route.test.ts`: `full_name: null, avatar_url: null` → `undefined`
- `src/app/api/videos/route.test.ts`: 3 inline objects with same null → undefined

### B) videos/route.test.ts null assignment (6 errors)
- Same as A — fixed by replacing `null` with `undefined` on `full_name`/`avatar_url` fields
- `User` type defines these as `string | undefined` not `string | null`

### C) BigInt literals (6 errors)
- `tsconfig.json`: `target` bumped `ES2017` → `ES2020`
- Cleared `.tsbuildinfo` cache to force rescan

### D) Sentry options test (4 errors)
- `src/lib/observability/sentry-options.test.ts`: cast `fakeEvent` via `as unknown as` at call site
- Accessed `result.extra` via intermediary `resultWithExtra: { extra?: Record<string, unknown> } | null`

### E) D1Client casts in tests (3 errors)
- `src/app/api/r/[code]/route.test.ts:38`: `as ReturnType<...>` → `as unknown as ReturnType<...>`
- `src/lib/affiliate-shortlink/click-logger.test.ts:36`: same pattern
- `src/app/api/coupons/apply/route.ts`: replaced `createServerClient()` with `await getD1Raw()` — D1Client has no `.prepare()`, D1Database does

### F) Wave-introduced errors (3 errors)
- `src/lib/cron/run-tracker.test.ts`: extracted `BasePrepareResult` type alias; added explicit return type on `basePrepare()` to break recursive self-reference
- `src/lib/security/use-csrf-token.ts`: added explicit `: Record<string, string>` return type annotation on `useMemo` callback
- `src/lib/utils/logger-internals.ts`: widened stored `_sentryModule.captureException` signature to `(err: unknown, ctx?: Record<string, unknown>) => unknown`

---

## next.config.ts
`ignoreBuildErrors` changed from `true` → `false`. Build passes clean.

---

## Results
- `npx tsc --noEmit`: **0 errors**
- `npm run build`: **exit 0** (no TS errors; only Sentry/Turbopack warnings)
- `npm test`: **1673 passed | 31 skipped** (matches baseline)
