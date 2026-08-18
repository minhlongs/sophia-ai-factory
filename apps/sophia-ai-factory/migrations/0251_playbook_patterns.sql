-- Migration: 0251_playbook_patterns
-- Phase 5: Auto-Creative Playbook — COMPOUND stage
-- Stores auto-detected winning patterns and the derived playbook rules.

CREATE TABLE IF NOT EXISTS playbook_patterns (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,        -- e.g. 'hook_type', 'duration', 'channel', 'posting_time_bucket'
  feature_value TEXT NOT NULL,      -- e.g. 'curiosity_gap', '60s', 'tiktok', 'prime'
  metric TEXT NOT NULL,             -- e.g. 'ctr', 'conversion_rate', 'revenue_per_view'
  avg_metric REAL NOT NULL,
  sample_size INTEGER NOT NULL,
  confidence REAL NOT NULL,         -- 0..1, derived from sample_size + consistency
  confidence_level TEXT NOT NULL DEFAULT 'medium', -- 'high'|'medium'|'low'
  source TEXT NOT NULL DEFAULT 'experiment', -- 'experiment'|'memory'|'roi'
  detected_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_playbook_patterns_workspace
  ON playbook_patterns(workspace_id, feature_key, feature_value, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_playbook_patterns_confidence
  ON playbook_patterns(workspace_id, confidence_level DESC, detected_at DESC);

CREATE TABLE IF NOT EXISTS playbook_rules (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  pattern_id TEXT NOT NULL,
  platform TEXT NOT NULL,           -- ChannelProvider value
  goal TEXT NOT NULL,               -- e.g. 'awareness', 'conversion', 'retention'
  rule_vi TEXT NOT NULL,            -- Vietnamese rule text
  rule_en TEXT NOT NULL,            -- English rule text
  confidence REAL NOT NULL,
  sample_size INTEGER NOT NULL,
  applied_count INTEGER NOT NULL DEFAULT 0,
  auto_apply INTEGER NOT NULL DEFAULT 0, -- 1 = eligible for auto-apply (>90% confidence)
  rollback_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_playbook_rules_workspace
  ON playbook_rules(workspace_id, platform, goal, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_playbook_rules_auto_apply
  ON playbook_rules(workspace_id, auto_apply, confidence DESC);