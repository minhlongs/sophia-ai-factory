-- Migration: 0257_production_factory
-- Phase 3: Autonomous Factory — schema for multi-agent production graphs.
-- Adds the mission_type discriminator on creative_missions plus the three
-- new tables backing mission-type policies, production graph definitions,
-- and production graph runs. Fully additive; no change to existing columns.

ALTER TABLE creative_missions
  ADD COLUMN mission_type TEXT NOT NULL DEFAULT 'general';

CREATE TABLE IF NOT EXISTS mission_type_policies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  mission_type TEXT NOT NULL,
  autonomy_tier INTEGER NOT NULL DEFAULT 2,          -- L0 manual .. L3 full auto
  require_publish_approval INTEGER NOT NULL DEFAULT 1, -- 0/1 boolean
  max_cost_cents_per_run INTEGER,                    -- NULL = no cap
  max_auto_retries INTEGER NOT NULL DEFAULT 3,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(workspace_id, mission_type)
);

CREATE INDEX IF NOT EXISTS idx_mtp_workspace
  ON mission_type_policies(workspace_id);

CREATE TABLE IF NOT EXISTS production_graphs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  mission_type TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  definition_json TEXT NOT NULL,   -- JSON: GraphDefinition (nodes + edges)
  is_template INTEGER NOT NULL DEFAULT 1, -- 0/1 boolean
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_graphs_workspace
  ON production_graphs(workspace_id);

CREATE TABLE IF NOT EXISTS production_graph_runs (
  id TEXT PRIMARY KEY,
  graph_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',   -- queued|running|awaiting_approval|completed|failed|cancelled
  phase TEXT NOT NULL DEFAULT 'planning',  -- planning|executing|awaiting_approval|publishing|review
  node_states_json TEXT,                   -- JSON: per-node checkpoint states for resume
  output_json TEXT,                        -- JSON: final run output
  error_json TEXT,                         -- JSON: structured error (code + details)
  error_message TEXT,
  total_cost_cents INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  started_at INTEGER,
  ended_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_graph_runs_workspace
  ON production_graph_runs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_graph_runs_status
  ON production_graph_runs(workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_graph_runs_mission
  ON production_graph_runs(mission_id);
