-- Migration 0046: Unique indexes on billing_events for outage tracking idempotency
-- Prevents duplicate outage_apology_sent and outage_compensation events per purchase.
--
-- !! LOCAL ONLY — DO NOT apply to remote/production automatically.
-- Apply via: wrangler d1 execute sophia-raas-db --local --file=migrations/0046-billing-events-outage-tracking.sql
--
-- outage_apology_sent: one apology email per purchase per outage window
-- outage_compensation: one TTL extension per purchase
--
-- Uses partial unique index on (license_nonce, event_type) filtered by event_type.
-- D1/SQLite supports partial indexes via WHERE clause (SQLite 3.8+).

CREATE UNIQUE INDEX IF NOT EXISTS billing_events_outage_apology_unique_idx
  ON billing_events (license_nonce, event_type)
  WHERE event_type = 'outage_apology_sent';

CREATE UNIQUE INDEX IF NOT EXISTS billing_events_outage_compensation_unique_idx
  ON billing_events (license_nonce, event_type)
  WHERE event_type = 'outage_compensation';
