-- Migration: Unique constraint on billing_events to prevent double compensation grants
-- M1 fix: prevents TOCTOU race where webhook + cron both grant +1 credit
-- for the same purchase (both read "not granted" before first INSERT completes).
--
-- Uses partial index: only enforce uniqueness for compensation_granted events.
-- Existing non-compensation events are unaffected.

CREATE UNIQUE INDEX IF NOT EXISTS billing_events_compensation_unique_idx
  ON billing_events (license_nonce, event_type)
  WHERE event_type = 'compensation_granted';
