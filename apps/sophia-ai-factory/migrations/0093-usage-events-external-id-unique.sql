-- Migration: 0093 - usage_events external_id column + unique index
-- Created: 2026-05-09
-- Purpose: Promote event_id (advisory Round-10 F-2 field) to DB-enforced
--          external_id with a partial UNIQUE index for idempotent retries.
--
-- Context: batchUsageRecordSchema already accepts event_id (optional UUID).
--          Server currently treats it as advisory only. This migration adds
--          the column + index so INSERT ... ON CONFLICT can deduplicate at
--          DB level without application-layer pre-checks.
--
-- Idempotency contract:
--   - ADD COLUMN IF NOT EXISTS — safe to re-run; no-op if column exists.
--   - CREATE UNIQUE INDEX IF NOT EXISTS — safe to re-run; no-op if index exists.
--   - WHERE clause limits index to non-NULL rows only, so existing NULL rows
--     (legacy events without event_id) are never evaluated for uniqueness and
--     the migration does not reject any pre-existing data.
--
-- NOTE: The Supabase-hosted usage_events table (supabase/migrations/) already
--       has idempotency_key UNIQUE for its own dedup. This migration targets
--       the D1-layer ingestion path (forest/usage-metering) which stores events
--       via BatchUsageRecord.event_id.

ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_events_external_id_unique
  ON usage_events(external_id)
  WHERE external_id IS NOT NULL;
