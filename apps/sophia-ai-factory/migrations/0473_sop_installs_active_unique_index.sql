-- Migration: 0473_sop_installs_active_unique_index.sql
-- Description: Enforce at most one active install per user per listing via partial unique index
-- Layer: seed/db/migrations
-- Preflight audit query for duplicate active installs (MUST run and verify 0 rows before applying):
-- SELECT user_id, listing_id, COUNT(*) as cnt FROM sop_installs WHERE status = 'active' GROUP BY user_id, listing_id HAVING cnt > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sop_installs_user_listing_active
  ON sop_installs (user_id, listing_id)
  WHERE status = 'active';
