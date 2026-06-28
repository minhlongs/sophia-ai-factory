# Phase 10A — M-1 Column Rename Fix Report

**Status:** COMPLETED  
**Date:** 2026-04-20

## Files Modified

| File | LOC delta |
|------|-----------|
| `src/lib/admin/monitoring-queries.ts` | +4 / -3 |
| `src/app/api/admin/llm-trace-stats/route.ts` | +3 / -2 |
| `src/lib/admin/monitoring-queries.test.ts` | +22 / -6 |
| `src/app/api/admin/llm-trace-stats/route.test.ts` | +11 / -5 |

## Changes

**3 queries fixed** — all replaced `created_at >= datetime('now',...)` with `ts >= ?` bind pattern:

1. `aggregateByokEvents` (monitoring-queries.ts:157–167): compute `cutoffMs = Date.now() - hoursBack * 3600 * 1000`, bind numeric ms
2. `getTraceStats` (monitoring-queries.ts:195–201): same 24h cutoff pattern; SQL also corrected `props` → `props_json AS props` (schema column is `props_json`)
3. `GET /api/admin/llm-trace-stats` (route.ts:54–59): same fix as #2

**Gotcha:** Schema column is `props_json` not `props`. The old `SELECT props` would have returned `undefined`/null for every row — `TraceRow.props` would be undefined, JSON.parse would throw, aggregator would silently skip all rows. Fixed to `SELECT props_json AS props` to preserve JS field name `props` expected by `aggregateTraceStats`.

## Tests

- `pnpm vitest run` → **30/30 passed** (0 failures)
- `grep -n "created_at"` in both implementation files → **0 hits**
- New assertions: SQL contains `ts >= ?`, bind receives `Number`, no `datetime('now',...)`

## Acceptance Criteria

- [x] 0 `created_at` refs in owned files
- [x] All 3 queries use `ts >= ?` bind pattern
- [x] 30/30 tests pass
- [x] No new `any` types introduced
