-- Migration: Unique constraint on billing_events to prevent double compensation grants
-- M1 fix: prevents TOCTOU race where webhook + cron both grant +1 credit
-- for the same purchase (both read "not granted" before first INSERT completes).
--
-- Uses partial index: only enforce uniqueness for compensation_granted events.
-- Existing non-compensation events are unaffected.
--
-- !! MANUAL APPLY REQUIRED (automated apply failed — no Supabase auth token) !!
-- Steps to apply:
--   1. Open Supabase SQL Editor:
--      https://supabase.com/dashboard/project/<project-ref>/sql/new
--   2. Paste the CREATE UNIQUE INDEX statement below and click Run (Cmd+Enter).
--   3. Verify with:
--      SELECT indexname FROM pg_indexes
--      WHERE tablename = 'billing_events'
--        AND indexname = 'billing_events_compensation_unique_idx';
--      → should return 1 row.
-- OR via psql:
--   PGPASSWORD=<db-password> psql "postgresql://postgres.<project-ref>:5432/postgres" \
--     -c "CREATE UNIQUE INDEX IF NOT EXISTS billing_events_compensation_unique_idx
--         ON billing_events (license_nonce, event_type)
--         WHERE event_type = 'compensation_granted';"
-- Project ref: check NEXT_PUBLIC_SUPABASE_URL env var → extract subdomain.

CREATE UNIQUE INDEX IF NOT EXISTS billing_events_compensation_unique_idx
  ON billing_events (license_nonce, event_type)
  WHERE event_type = 'compensation_granted';
