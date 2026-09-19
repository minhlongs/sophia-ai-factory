-- Migration: 0274_playbook_campaign_intelligence
-- Phase 5: Auto-Creative Playbook & Campaign Intelligence
-- Adds unique constraint index on playbook_patterns and defines tables for campaign blueprints and recurring campaign runs.

-- 1. Unique index on playbook_patterns for idempotent ON CONFLICT upsert
CREATE UNIQUE INDEX IF NOT EXISTS uidx_playbook_patterns_upsert
  ON playbook_patterns(workspace_id, feature_key, feature_value, metric);

-- 2. Campaign Blueprints table: repeatable creative templates synthesized from winning patterns
CREATE TABLE IF NOT EXISTS campaign_blueprints (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_vi TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_vi TEXT NOT NULL,
  target_platform TEXT NOT NULL,    -- 'youtube_shorts' | 'tiktok' | 'instagram_reels'
  hook_style TEXT NOT NULL,         -- 'curiosity_gap' | 'bold_claim' | 'problem_agitation' | 'question' | 'story_lead' | 'statistic_reveal'
  voice_style TEXT NOT NULL,        -- 'dynamic_hook' | 'enthusiastic_recommender' | 'calm_authoritative' | 'cinematic_narrator'
  duration_seconds INTEGER NOT NULL DEFAULT 60,
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  estimated_scenes INTEGER NOT NULL DEFAULT 4,
  suggested_prompts TEXT NOT NULL DEFAULT '[]', -- JSON array of { en: string, vi: string }
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_campaign_blueprints_workspace
  ON campaign_blueprints(workspace_id, is_active, updated_at DESC);

-- 3. Recurring Campaign Runs table: automated scheduled batch video runs
CREATE TABLE IF NOT EXISTS recurring_campaign_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  blueprint_id TEXT NOT NULL REFERENCES campaign_blueprints(id),
  schedule_cron TEXT NOT NULL,      -- e.g. '0 9 * * *' (daily 09:00 UTC)
  batch_size INTEGER NOT NULL DEFAULT 1,
  next_run_at INTEGER NOT NULL,
  last_run_at INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  total_runs INTEGER NOT NULL DEFAULT 0,
  last_status TEXT NOT NULL DEFAULT 'idle', -- 'idle' | 'running' | 'completed' | 'failed'
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_recurring_campaign_runs_next
  ON recurring_campaign_runs(is_active, next_run_at ASC);

CREATE INDEX IF NOT EXISTS idx_recurring_campaign_runs_workspace
  ON recurring_campaign_runs(workspace_id, is_active, created_at DESC);
