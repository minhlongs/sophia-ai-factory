-- Mission Lifecycle — Sophia 2027 Creative Economy OS
-- Top-level orchestration object for creative/business objectives.
-- Layer: tree (domain-specific reusable)
-- NOTE: renamed to creative_missions to avoid collision with Mekong `missions` table.

CREATE TABLE IF NOT EXISTS creative_missions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  brand_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  objective TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  geography TEXT NOT NULL DEFAULT '',
  timeframe_start INTEGER NOT NULL,
  timeframe_end INTEGER NOT NULL,
  budget_cents INTEGER NOT NULL DEFAULT 0,
  spent_cents INTEGER NOT NULL DEFAULT 0,
  autonomy_level INTEGER NOT NULL DEFAULT 2,
  channels TEXT NOT NULL DEFAULT '[]',
  monetization_goals TEXT NOT NULL DEFAULT '[]',
  constraints TEXT NOT NULL DEFAULT '{}',
  success_metrics TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  current_phase TEXT NOT NULL DEFAULT 'init',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_creative_missions_workspace ON creative_missions (workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creative_missions_creator ON creative_missions (creator_id);

-- CreativeGoal — sub-entity of mission
CREATE TABLE IF NOT EXISTS creative_goals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  mission_id TEXT,
  type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  target_metric TEXT NOT NULL DEFAULT '',
  target_value REAL NOT NULL DEFAULT 0,
  current_value REAL NOT NULL DEFAULT 0,
  timeframe_start INTEGER NOT NULL,
  timeframe_end INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_creative_goals_mission ON creative_goals (mission_id);
CREATE INDEX IF NOT EXISTS idx_creative_goals_workspace ON creative_goals (workspace_id, status);