-- CreativeMemory — Sophia 2027 Creative Economy OS
-- Persistent, versioned, scoped memory across 7 categories.
-- Layer: tree (domain-specific reusable)

CREATE TABLE IF NOT EXISTS creative_memory (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  category TEXT NOT NULL, -- 'identity'|'creative'|'audience'|'performance'|'business'|'operational'|'provenance'
  key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '{}',
  confidence TEXT NOT NULL DEFAULT 'medium', -- 'high'|'medium'|'low'
  source TEXT NOT NULL DEFAULT 'agent_inference', -- 'performance'|'human_edit'|'agent_inference'|'import'
  evidence TEXT NOT NULL DEFAULT '[]',
  scope TEXT NOT NULL DEFAULT 'global', -- 'global'|'campaign'|'project'|'channel'
  scope_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_creative_memory_active
  ON creative_memory (workspace_id, category, key, scope, scope_id)
  WHERE is_deleted = 0;

CREATE INDEX IF NOT EXISTS idx_creative_memory_workspace
  ON creative_memory (workspace_id, category, is_deleted, updated_at DESC);