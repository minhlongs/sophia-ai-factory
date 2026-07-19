---
title: "Phase 01: Database Migration"
description: "Add missing columns, indexes, and time-series optimization to usage_events table"
status: pending
priority: P1
effort: 1.5h
---

# Phase 01: Database Migration

## Context

From `researcher-usage-metering-report.md`:
- `usage_events` table exists but missing critical columns
- `idempotency_key` tracked in code but not in migration
- `external_customer_id` used in types but not in schema
- No time-series columns for partition pruning

## Requirements

**Functional:**
1. Add `idempotency_key` column with unique partial index
2. Add `external_customer_id` column with index
3. Add `hour_bucket` and `day_bucket` columns for rollup optimization
4. Add `resource_type` column for granular tracking
5. Backfill existing rows with computed bucket values

**Non-Functional:**
1. Zero-downtime migration (CONCURRENTLY where possible)
2. Idempotent migration script (safe to run multiple times)
3. All indexes created with proper WHERE clauses for partial indexing

## Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260307-usage-metering-complete.sql` | Create | Master migration script |
| `docs/migrations/usage-events-schema.sql` | Update | Reference schema with all columns |
| `src/lib/supabase/types.ts` | Update | Add new columns to TypeScript types |

## Implementation Steps

### 1. Create Migration Script

```sql
-- File: supabase/migrations/20260307-usage-metering-complete.sql
-- Purpose: Comprehensive usage metering schema

-- Step 1: Add idempotency_key column
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Step 2: Add external_customer_id column
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS external_customer_id TEXT;

-- Step 3: Add time-series bucket columns
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS hour_bucket BIGINT,
  ADD COLUMN IF NOT EXISTS day_bucket BIGINT;

-- Step 4: Backfill existing rows
UPDATE usage_events
SET
  hour_bucket = created_at - (created_at % 3600),
  day_bucket = created_at - (created_at % 86400)
WHERE hour_bucket IS NULL;

-- Step 5: Create unique partial index for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_events_idempotency
  ON usage_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Step 6: Create indexes for external customer lookups
CREATE INDEX IF NOT EXISTS idx_usage_events_external_customer
  ON usage_events(external_customer_id)
  WHERE external_customer_id IS NOT NULL;

-- Step 7: Create time-series indexes for rollup queries
CREATE INDEX IF NOT EXISTS idx_usage_events_hour_bucket
  ON usage_events(hour_bucket DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_day_bucket
  ON usage_events(day_bucket DESC);

-- Step 8: Create composite index for common rollup pattern
CREATE INDEX IF NOT EXISTS idx_usage_events_rollup
  ON usage_events(hour_bucket, user_id, license_nonce)
  INCLUDE (service_name, credits_used, tokens_input, tokens_output, status_code, response_time_ms);

-- Step 9: Add comments for documentation
COMMENT ON COLUMN usage_events.idempotency_key IS 'Unique key to prevent duplicate tracking on retries';
COMMENT ON COLUMN usage_events.external_customer_id IS 'External billing system customer ID (Stripe or Polar)';
COMMENT ON COLUMN usage_events.hour_bucket IS 'Hour boundary (Unix timestamp) for rollup aggregation';
COMMENT ON COLUMN usage_events.day_bucket IS 'Day boundary (Unix timestamp) for daily rollup';
```

### 2. Update Reference Schema

Update `docs/migrations/usage-events-schema.sql` to include all new columns in the CREATE TABLE statement (not just ALTER TABLE).

### 3. Update TypeScript Types

Update `src/lib/supabase/types.ts` to include new columns in the `usage_events` table type.

### 4. Apply Migration

```bash
cd apps/sophia-ai-factory
npx supabase db push
```

### 5. Verify Migration

```sql
-- Verify columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'usage_events'
  AND column_name IN ('idempotency_key', 'external_customer_id', 'hour_bucket', 'day_bucket');

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'usage_events'
  AND indexname LIKE 'idx_usage_events%';

-- Verify row count and sample data
SELECT
  COUNT(*) as total_rows,
  COUNT(hour_bucket) as rows_with_buckets,
  COUNT(DISTINCT external_customer_id) as unique_customers
FROM usage_events;
```

## Success Criteria

- [ ] Migration script runs without errors
- [ ] All 4 new columns added successfully
- [ ] All 5 indexes created
- [ ] Existing rows backfilled with bucket values
- [ ] TypeScript types updated with no compile errors
- [ ] `npx supabase db push` completes successfully

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large table lock during ALTER | High | Use `ADD COLUMN IF NOT EXISTS` (fast for nullable) |
| Index creation timeout | Medium | Create indexes CONCURRENTLY if table > 1M rows |
| Backfill takes too long | Medium | Backfill in batches of 10K rows |

## Next Steps

After migration complete:
1. Proceed to Phase 02: Atomic Quota Enforcement
2. Test idempotency with concurrent requests
3. Verify rollup queries use new indexes
