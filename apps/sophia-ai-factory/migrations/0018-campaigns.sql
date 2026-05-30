-- Migration 0018: campaigns + campaign_checkpoints tables for D1 (SQLite)
-- Replaces Supabase-only schema (20260205132041_create_campaigns_table.sql)
-- No uuid, no gen_random_uuid(), no timestamptz, no jsonb, no RLS, no triggers

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  topic TEXT,
  audience TEXT,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','queued','processing_script','processing_video','completed','failed','video_timeout')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  template_id TEXT,
  script_content TEXT,        -- JSON-encoded { scenes: [...] }
  audio_url TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);

CREATE TABLE IF NOT EXISTS campaign_checkpoints (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  step_name TEXT NOT NULL,
  payload TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(campaign_id, step_name)
);
CREATE INDEX IF NOT EXISTS idx_checkpoints_campaign ON campaign_checkpoints(campaign_id);
