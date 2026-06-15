-- Migration 0049: Add status column to user table
-- Allows ops to pause/ban users without deleting accounts.

ALTER TABLE user ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active','paused','banned'));

CREATE INDEX IF NOT EXISTS user_status_idx ON user(status);
