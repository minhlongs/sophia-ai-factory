-- CreativeIdentity — Sophia 2027 Creative Economy OS
-- Stores versioned creative identity (voice, tone, brand, constraints)
-- Layer: tree (domain-specific reusable)

CREATE TABLE IF NOT EXISTS creative_identities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  brand_id TEXT,
  voice_description TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT 'casual',
  formality REAL NOT NULL DEFAULT 0.5,
  energy REAL NOT NULL DEFAULT 0.5,
  beliefs TEXT NOT NULL DEFAULT '[]',
  positioning TEXT NOT NULL DEFAULT '',
  target_audience TEXT NOT NULL DEFAULT '',
  forbidden_patterns TEXT NOT NULL DEFAULT '[]',
  required_disclosures TEXT NOT NULL DEFAULT '[]',
  preferred_formats TEXT NOT NULL DEFAULT '[]',
  reference_works TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_creative_identities_workspace
  ON creative_identities (workspace_id, is_active, version DESC);