# Phase 4A Report — D1 Migrations + RPC Shim

## Status: COMPLETED

## Files Modified
- `migrations/0013-rate-limits.sql` (created, 10 lines) — `rate_limits` table + `idx_rate_limits_window_start`
- `migrations/0014-export-jobs.sql` (created, 18 lines) — `export_jobs` table + 2 indexes
- `src/lib/db/d1-query-builder.ts` (extended, +28 lines) — `increment_rate_limit` case in `.rpc()` switch + private `incrementRateLimit()` method

## Key Changes
- Both migrations idempotent (`IF NOT EXISTS`)
- `incrementRateLimit` uses atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING` — single D1 round-trip
- Window expiry check via `strftime('%s', window_start) < windowStart` (unix seconds comparison)
- No new `:any` types; `windowStart` typed `number` from `Math.floor(Date.now()/1000)`

## Verification
- `CREATE TABLE` count: 0013=1, 0014=1
- `increment_rate_limit` found at line 404 in d1-query-builder.ts
- ESLint: EXIT 0, 0 errors
