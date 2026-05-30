-- Migration 0041: Refund-aware video access control
-- Adds access_revoked flag to videos table.
-- When a purchase is refunded, set access_revoked=1 on all linked videos
-- to prevent continued access to rendered content.
-- Default 0 = not revoked (backward compatible with all existing rows).

ALTER TABLE videos ADD COLUMN access_revoked INTEGER NOT NULL DEFAULT 0;

-- Partial index: fast lookup for revoked videos (expected to be rare)
CREATE INDEX IF NOT EXISTS idx_videos_access_revoked ON videos(access_revoked) WHERE access_revoked = 1;
