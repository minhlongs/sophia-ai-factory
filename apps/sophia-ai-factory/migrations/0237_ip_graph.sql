-- IP Graph — Sophia 2027 Creative Economy OS
-- Intellectual property entities: universe, world, series, character, theme, brand
-- Layer: tree (domain-specific reusable)

CREATE TABLE IF NOT EXISTS ip_entities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  metadata TEXT NOT NULL DEFAULT '{}',
  parent_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ip_entities_workspace
  ON ip_entities (workspace_id, type);
CREATE INDEX IF NOT EXISTS idx_ip_entities_parent
  ON ip_entities (parent_id);