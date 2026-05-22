-- Migration: sop_templates
-- Stores serialized SOPGraph definitions as reusable workflow templates.

CREATE TABLE IF NOT EXISTS sop_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  graph_json TEXT NOT NULL,  -- serialized SOPGraph JSON
  version INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,  -- 0=archived, 1=active
  category TEXT,  -- e.g. 'video', 'content', 'marketing'
  created_by TEXT NOT NULL,  -- user_id
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sop_templates_active ON sop_templates(is_active, category);
CREATE INDEX IF NOT EXISTS idx_sop_templates_creator ON sop_templates(created_by, updated_at DESC);
