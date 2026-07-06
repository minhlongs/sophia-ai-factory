-- Migration: ceo_campaigns table for CEO Agent Campaign Management
-- Supports BASIC (read-only)/PREMIUM (limited)/ENTERPRISE+ (full)
CREATE TABLE IF NOT EXISTS ceo_campaigns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  niche TEXT,
  topic TEXT,
  goal TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  status TEXT NOT NULL DEFAULT 'draft',
  model TEXT,
  generated_script TEXT,
  generated_voiceover TEXT,
  generated_visuals TEXT,
  output_url TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ceo_campaigns_user
  ON ceo_campaigns(user_id);
