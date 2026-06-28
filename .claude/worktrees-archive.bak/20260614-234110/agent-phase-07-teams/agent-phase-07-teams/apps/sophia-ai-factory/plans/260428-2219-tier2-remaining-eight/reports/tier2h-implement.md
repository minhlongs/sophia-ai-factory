# TIER-2H — Data Quality (Audit Logging + Constraint Validation) Report

**Status:** COMPLETE
**Date:** 2026-04-29

## Files Created/Modified

| File | Action | LOC |
|------|--------|-----|
| `migrations/0027-data-quality-audit.sql` | created | 20 |
| `src/lib/db/audit/audit-log.ts` | created | 112 |
| `src/lib/db/audit/audit-log.test.ts` | created | 147 |
| `src/lib/billing/nowpayments-ipn-subscription.ts` | modified | +11 |
| `src/lib/db/client.ts` | modified | +8 (getD1Raw export) |

## Tasks Completed

- [x] Migration `0027-data-quality-audit.sql`: `audit_log` table + composite index on (table_name, row_id, created_at)
- [x] `audit-log.ts`: `recordAudit()` + `queryAuditTrail()` + `TierEnum` + `AuditActionSchema` Zod schemas
- [x] Wired `recordAudit()` into `handleFinished()` — fires after subscription activation (non-fatal catch)
- [x] Vitest tests: 9/9 pass (insert, non-fatal error path, JSON serialization, queryAuditTrail, TierEnum/AuditAction validation)

## Test Results

```
Test Files: 1 passed (1)
Tests:      9 passed (9)
Duration:   470ms
```

## D1 / SQLite Constraint Note

**D1 does NOT support `ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS`.**

SQLite CHECK constraints on existing tables require a full table recreate — too risky for production data. Resolution:

1. `audit_log` table created WITH inline CHECK on `action` column
2. `tier_change_events` tier enum validated at app layer via `TierEnum` Zod schema (exported from `audit-log.ts`) — not added as DB CHECK to avoid data risk
3. New `tier_change_events` inserts should go through Zod validation before hitting D1

## Architecture Decisions

- `recordAudit()` accepts raw `D1Database` (not `D1Client`) — avoids coupling to query-builder
- `getD1Raw()` added to `client.ts` as the canonical way to get raw binding for audit/low-level ops
- Audit writes are fire-and-forget wrapped in `try/catch { /* non-fatal */ }` — never blocks payment flow
- `before_json` / `after_json` are nullable TEXT — no schema change needed for query-only audit reads
