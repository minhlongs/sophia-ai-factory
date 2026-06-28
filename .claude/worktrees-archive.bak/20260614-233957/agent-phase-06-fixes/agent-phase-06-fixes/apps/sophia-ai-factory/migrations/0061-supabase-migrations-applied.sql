-- Migration 0061: supabase_migrations_applied
-- Tracks which Supabase migrations have been applied via the admin Migration Console.
-- Admin marks applied after running SQL in Supabase dashboard.

CREATE TABLE IF NOT EXISTS supabase_migrations_applied (
  filename TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  applied_by_user_id TEXT NOT NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS supabase_migrations_applied_at_idx
  ON supabase_migrations_applied(applied_at DESC);
