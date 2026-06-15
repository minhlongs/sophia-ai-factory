-- Migration: video_usage_monthly
-- Purpose: Per-user, per-month video quota counter table.
--          Deliberately separate from the credit/nonce billing tables to keep
--          video rate-limiting decoupled from payment flows.
-- Schema decision: year_month as TEXT "YYYY-MM" (simple, sortable, no epoch math needed).

CREATE TABLE IF NOT EXISTS video_usage_monthly (
  user_id    TEXT NOT NULL,
  year_month TEXT NOT NULL,           -- "YYYY-MM", e.g. "2026-04"
  count      INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,           -- ISO 8601 timestamp

  PRIMARY KEY (user_id, year_month)
);
-- Note: PK already covers (user_id, year_month) lookups; no separate index needed.
