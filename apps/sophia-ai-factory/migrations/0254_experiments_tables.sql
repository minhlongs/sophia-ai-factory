-- Migration: 0254_experiments_tables
-- Phase 2: Creative Intelligence — schema rescue for tree/performance/experiment.ts
-- Creates the three tables its INSERT/SELECT statements already target
-- (experiments / experiment_variants / experiment_results). Fully additive;
-- no ALTER on existing tables.

CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT,
  hypothesis TEXT,
  metric TEXT,
  audience TEXT,
  channel TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- ExperimentStatus: draft|running|completed|cancelled
  started_at INTEGER,
  ended_at INTEGER,
  winner_variant_id TEXT,
  confidence REAL,
  result TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_experiments_workspace
  ON experiments(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_experiments_project
  ON experiments(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_experiments_status
  ON experiments(workspace_id, status);

CREATE TABLE IF NOT EXISTS experiment_variants (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  asset_id TEXT,
  traffic_percent REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_experiment_variants_experiment
  ON experiment_variants(experiment_id);

CREATE INDEX IF NOT EXISTS idx_experiment_variants_asset
  ON experiment_variants(asset_id);

CREATE TABLE IF NOT EXISTS experiment_results (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  conversion_rate REAL NOT NULL DEFAULT 0,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,                    -- JSON object stringified by repository
  recorded_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_experiment_results_experiment
  ON experiment_results(experiment_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_experiment_results_variant
  ON experiment_results(variant_id);
