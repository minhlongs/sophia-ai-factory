# Phase 18 — `toError()` Slice 5 (next 29 sites)

**Status:** ✅ COMPLETE (2026-04-20)
**Priority:** P2 (Tech-debt polish — Phase 13/14/15/16/17 continuation)
**Session:** CLOSED

## Scope

Fifth slice of the `as Error` → `toError()` migration. 29 sites across 10 files — now covering React hook/component scope and API routes.

### Target Files (29 sites)

| File | Casts | Notes |
|------|-------|-------|
| `src/components/admin/licenses/use-license-list-actions.ts` | 4 | React hook scope |
| `src/app/api/license/sync/route.ts` | 4 | API route (sync handlers) |
| `src/worker/lib/metering-reconciler-runner.ts` | 3 | Worker; incl. 1 `const err = error as Error` idiom |
| `src/lib/raas-gateway-client.ts` | 3 | WS + polling + API key validation |
| `src/lib/alerts/supabase-realtime-alert-service.ts` | 3 | alternate Supabase realtime path |
| `src/hooks/use-analytics-data.ts` | 3 | SWR hooks |
| `src/app/api/admin/api-keys/route.ts` | 3 | incl. inline `.catch(e => logger.error(..., e as Error))` |
| `src/lib/raas/raas-rate-limiter.ts` | 2 | |
| `src/lib/quota/overage-logger.ts` | 2 | |
| `src/lib/ingestion/runner.ts` | 2 | 2× inline `(error as Error).message` on object literal |

Remaining after Phase 18: ~78 `as Error` sites.

## Approach

Same as Phase 13/14/16/17 — patterns A/B/C unchanged. No new sub-pattern introduced by this slice (already handled: inline `.message`, aliased `const err`, logger direct, arrow-fn inline).

### Scope notes

- **React hook/component scope** (`use-license-list-actions.ts`, `use-analytics-data.ts`): first Phase-XX-migration to touch `src/components/` + `src/hooks/`; `@/lib/utils/to-error` resolves in browser bundle (client component scope) the same as in server code.
- **`logger-utility.ts` skipped** this phase — its 2 remaining `as Error | undefined` / `as Error | Record<...>` casts are union-type assertions used for overload resolution, not simple error narrowing. Separate handling (probably proper overload typing) required; deferred.

## Non-Goals

- Helper changes — locked in Phase 13+15.
- Remaining ~78 `as Error` sites — Phase 19+ continues.
- `instanceof Error` ternary simplifications.
- `logger-utility.ts` union-type casts.
- ESLint rule to enforce `toError()`.

## Files to Edit

- `src/components/admin/licenses/use-license-list-actions.ts`
- `src/app/api/license/sync/route.ts`
- `src/worker/lib/metering-reconciler-runner.ts`
- `src/lib/raas-gateway-client.ts`
- `src/lib/alerts/supabase-realtime-alert-service.ts`
- `src/hooks/use-analytics-data.ts`
- `src/app/api/admin/api-keys/route.ts`
- `src/lib/raas/raas-rate-limiter.ts`
- `src/lib/quota/overage-logger.ts`
- `src/lib/ingestion/runner.ts`

## Success Criteria

- [x] Build: 0 new TS errors on 10 edited files
- [x] Tests: 1306/1306 pass (baseline unchanged)
- [x] Lint: 0 new errors on 10 edited files
- [x] 29 `as Error` sites → 0 across 10 files
- [x] No behavior regression
- [x] Code review ≥9.5/10 APPROVE → auto-ship ✅ 9.8/10 SHIP
- [x] CI GREEN + Production HTTP 200
- [x] `@/lib/utils/to-error` validated in React client scope (tree-shake clean)

## Results (2026-04-20)

| Metric | Value |
|--------|-------|
| Files Edited | 10 |
| `as Error` Sites Migrated | 29 (25 direct + 1 aliased `const err` + 1 `.catch` arrow + 2 inline `.message`) |
| Tests | 1306/1306 (baseline unchanged — pure migration) |
| TSC Errors | 0 new on 10 files (40 baseline → 40) |
| Lint Errors | 0 new on 10 files (17 baseline → 17) |
| Code Review | 9.8/10 APPROVE SHIP (0 critical/high/medium/low) |
| New Scope Validated | React client bundle (`'use client'` hook + component) |

## Risk Assessment

- **Risk:** VERY LOW — pure migration, identical to Phase 13/14/16/17 patterns.
- **Rollback:** revert-safe.
- **First-time scope expansion:** React client bundle — confirm no tree-shake issue (helper is a single-export 40-line util, should inline without issue).

## Deferred (Phase 19+ backlog)

- Remaining ~78 `as Error` sites (~3 slices left)
- 244 `instanceof Error` ternary simplifications
- `logger-utility.ts` union-type casts (overload typing)
- `ClientWithStorage` → R2 migration
- ESLint rule to enforce `toError()`
- Logger-utility structured metadata pickup
- enriched-jwt.ts logger-signature tech debt (lines 220/294/399)
- `raas_licenses` D1-vs-Supabase audit
- Split `lib/usage-metering/types.ts`
