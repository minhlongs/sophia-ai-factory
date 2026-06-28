-- Migration 0039: Add purchase_id column to videos table
-- Links one-time bundle videos to their purchase row for traceability.
-- Nullable — subscription/manual videos have no purchase_id.

ALTER TABLE videos ADD COLUMN purchase_id TEXT REFERENCES user_purchases(id);

CREATE INDEX IF NOT EXISTS idx_videos_purchase_id
  ON videos (purchase_id) WHERE purchase_id IS NOT NULL;
