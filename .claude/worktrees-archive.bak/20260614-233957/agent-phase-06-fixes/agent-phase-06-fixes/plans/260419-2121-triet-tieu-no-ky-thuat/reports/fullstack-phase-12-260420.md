# Phase 12 Migration Report — DB Helpers Caller Migration

**Date:** 2026-04-20  
**Status:** COMPLETE

---

## Files Edited (13 files)

**Task 1 — D1Response import migration (6 files):**
- `src/lib/usage-metering/usage-kv-sync.ts`
- `src/lib/usage-metering/export.ts`
- `src/lib/usage-metering/usage-rollup-engine.ts`
- `src/lib/usage-metering/tracker.ts`
- `src/app/api/v1/usage/batch/route.ts`
- `src/lib/usage-metering/types.ts` (removed D1Response definition)

**Task 2 — insertTyped migration (7 files):**
- `src/lib/audit/logger/audit-event-builder.ts` (spike — 1 site)
- `src/lib/audit/report-scheduler.ts` (1 site)
- `src/lib/audit/violation-logger.ts` (1 site)
- `src/lib/audit/usage-event-tracker.ts` (2 sites)
- `src/lib/audit/audit-query-logger.ts` (4 sites)
- `src/lib/usage-metering/tracker.ts` (1 site)

**Helper fix:**
- `src/lib/db/insert-typed.ts` — added `<R>` type param so `D1QueryChain<T>` passes correctly

---

## Spike Result

Spike on `audit-event-builder.ts:22` exposed a type mismatch: `insertTyped(chain: D1QueryChain, payload)` didn't accept `D1QueryChain<RaasAuditLogRow>` because `D1QueryChain<T>` is invariant on `T`. Fixed by adding `<R>` param to both helper functions (`insertTyped<R, T>` / `insertManyTyped<R, T>`). Spike passed after fix.

---

## Migration Counts

| Metric | Count |
|--------|-------|
| D1Response imports migrated | 5 |
| D1Response definition removed | 1 |
| insertTyped sites migrated | 10 |
| insertManyTyped sites migrated | 0 |

---

## Deviations from Plan

**billing/nowpayments-ipn-handlers.ts L283, L306**: These are NOT `.insert()` pattern — they are `recordIpnEvent(paymentId, status, ipn as unknown as Record<...>, bool)` — passing typed data to a function expecting `Record<string, unknown>`. `insertTyped` doesn't apply. Left unchanged (out of scope for this helper).

---

## Verification

```
grep -rnE '\.insert\([^)]+as unknown as Record' src/lib:
→ Only src/lib/db/insert-typed.ts (the helper itself) — CLEAN

grep -rn "D1Response.*from.*usage-metering/types":
→ empty — CLEAN

grep -n "D1Response" src/lib/usage-metering/types.ts:
→ empty — CLEAN
```

---

## Test Result

```
Test Files: 106 passed | 1 skipped (107)
Tests:      1297 passed | 31 skipped (1328)
Duration:   8.44s
```

## Type-Check Result

Zero errors in all 13 modified files. Pre-existing errors in `kv-metering-log-sync.ts` and `nowpayments-ipn-handlers.ts(89)` are out-of-scope WIP (upsert signature mismatch, Redis API mismatch).
