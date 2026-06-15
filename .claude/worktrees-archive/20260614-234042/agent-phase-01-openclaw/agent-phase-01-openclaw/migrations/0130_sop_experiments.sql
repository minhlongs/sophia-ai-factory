-- SOP Experiment Framework: tables for A/B testing SOP prompt variants and parameters.

CREATE TABLE IF NOT EXISTS sop_experiments (
  id TEXT PRIMARY KEY,
  sop_template_id TEXT NOT NULL,
  parameter_key TEXT NOT NULL,  -- which SOP parameter to vary (e.g. 'prompt_style', 'temperature')
  variants_json TEXT NOT NULL,  -- JSON array: [{key: 'control', value: ...}, {key: 'treatment', value: ...}]
  traffic_pct INTEGER NOT NULL DEFAULT 100,  -- percentage of executions enrolled (0-100)
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','concluded','archived')),
  winner_key TEXT,  -- set when concluded
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  concluded_at INTEGER
);

CREATE TABLE IF NOT EXISTS sop_experiment_assignments (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  variant_key TEXT NOT NULL,
  execution_id TEXT,  -- links to sop_executions
  outcome_json TEXT,  -- arbitrary outcome data (quality_score, duration, user_rating, etc.)
  assigned_at INTEGER NOT NULL,
  outcome_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sop_exp_template ON sop_experiments(sop_template_id, status);
CREATE INDEX IF NOT EXISTS idx_sop_exp_assign_user ON sop_experiment_assignments(experiment_id, user_id);
CREATE INDEX IF NOT EXISTS idx_sop_exp_assign_variant ON sop_experiment_assignments(experiment_id, variant_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sop_exp_assign_unique ON sop_experiment_assignments(experiment_id, user_id, execution_id);
