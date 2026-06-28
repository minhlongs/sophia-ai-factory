# Phase 19 — `toError()` Slice 6 (next 27 sites)

**Status:** ✅ COMPLETE (2026-04-20)
**Priority:** P2 (Tech-debt polish — Phase 13→18 continuation)
**Session:** CLOSED

## Scope

Sixth migration slice. 27 sites across 15 files — now tail of the list where each file has only 1–2 casts. Largest file-count phase so far; logger-utility.ts still deferred (union casts).

### Target Files (27 sites)

| File | Casts | Notes |
|------|-------|-------|
| `src/lib/db/d1-query-builder.ts` | 2 | inline `(err as Error).message` on QueryResult.error |
| `src/lib/clients/muapi-media-client.ts` | 2 | inline `(err as Error).message` on result |
| `src/lib/billing/dunning/dunning-actions.ts` | 2 | logger direct |
| `src/app/api/usage/reconciliation/sync/route.ts` | 2 | logger + requestId meta |
| `src/app/api/realtime/alerts/route.ts` | 2 | logger direct |
| `src/app/api/quota/overage-events/route.ts` | 2 | logger direct |
| `src/app/api/cron/scheduled-campaigns/route.ts` | 2 | multi-line logger arg |
| `src/app/api/cron/email-drip/route.ts` | 2 | template-literal logger msgs |
| `src/app/api/cron/dunning-advance/route.ts` | 2 | logger + meta object |
| `src/app/api/alerts/rules/route.ts` | 2 | GET + POST handlers |
| `src/app/api/alerts/preferences/route.ts` | 2 | GET + PUT handlers |
| `src/app/api/admin/violations/route.ts` | 2 | list + action handlers |
| `src/app/api/admin/dunning/status/route.ts` | 2 | status + action handlers |
| `src/worker/lib/reconciliation-alert-emitter.ts` | 1 | Worker scope |

Total 14 files × 2 + 1 × 1 = **27 sites**.

Remaining after Phase 19: ~51 `as Error` sites (1–2 more slices) + 2 in `logger-utility.ts` (deferred — overload typing work).

## Approach

Same as Phase 13–18. No new sub-pattern introduced.

### Import — add once per file

Each file gets `import { toError } from '@/lib/utils/to-error'` inserted after its existing `logger-utility` import (or after other `@/lib/*` imports for `d1-query-builder` / `muapi-media-client` which don't use logger).

## Non-Goals

- `logger-utility.ts` union casts (overload typing work — not in scope).
- Remaining ~49 `as Error` sites after this slice.
- `instanceof Error` ternary simplifications.
- ESLint rule to enforce `toError()`.

## Files to Edit

14 two-site files + 1 one-site file (list above).

## Success Criteria

- [x] Build: 0 new TS errors on 14 edited files
- [x] Tests: 1306/1306 pass (baseline unchanged)
- [x] Lint: 0 new errors on 14 edited files
- [x] 27 `as Error` sites → 0 across 14 files
- [x] No behavior regression
- [x] Code review ≥9.5/10 APPROVE → auto-ship ✅ 9.8/10 SHIP
- [x] CI GREEN + Production HTTP 200

## Results (2026-04-23)

| Metric | Value |
|--------|-------|
| Files Edited | 14 |
| `as Error` Sites Migrated | 27 (+43 / -27 diff) |
| Tests | 1306/1306 (baseline unchanged — pure migration) |
| TSC Errors | 0 new on 14 files (621 baseline) |
| Lint Errors | 0 new on 14 files |
| Code Review | 9.8/10 APPROVE SHIP (0 blockers) |
| Note | Plan originally estimated 29; scout recount after migration confirmed 27 (logger-utility.ts 2 casts correctly skipped) |

## Risk Assessment

- **Risk:** VERY LOW — mechanical migration, pattern locked since Phase 13.
- **Rollback:** revert-safe.
- **New consideration:** Largest file count in a single slice; higher chance of miss → verification grep after edits is mandatory.

## Deferred (Phase 20+ backlog)

- Remaining ~49 `as Error` sites (likely 2 more slices)
- `logger-utility.ts` 2× union-type casts (overload typing)
- 244 `instanceof Error` ternary simplifications
- `ClientWithStorage` → R2 migration
- ESLint rule to enforce `toError()`
- Logger-utility structured metadata pickup (`code/details/hint` on Error)
- enriched-jwt.ts logger-signature tech debt (lines 220/294/399)
- `raas_licenses` D1-vs-Supabase audit
- Split `lib/usage-metering/types.ts`
