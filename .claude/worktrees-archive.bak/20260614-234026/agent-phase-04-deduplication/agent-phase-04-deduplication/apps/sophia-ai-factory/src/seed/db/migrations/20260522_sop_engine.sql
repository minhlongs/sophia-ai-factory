-- SOP Engine: templates, installations, executions
-- Phase 01 of Solo SOPs Platform (260522)

CREATE TABLE IF NOT EXISTS sop_templates (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name_vi TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_vi TEXT,
  description_en TEXT,
  category TEXT NOT NULL CHECK(category IN ('content', 'business', 'marketing', 'operations')),
  difficulty TEXT NOT NULL DEFAULT 'beginner' CHECK(difficulty IN ('beginner', 'intermediate', 'advanced')),
  estimated_revenue_min INTEGER,
  estimated_revenue_max INTEGER,
  setup_time_minutes INTEGER NOT NULL DEFAULT 30,
  credits_per_run INTEGER NOT NULL DEFAULT 10,
  version INTEGER NOT NULL DEFAULT 1,
  steps_json TEXT NOT NULL,
  input_schema TEXT NOT NULL DEFAULT '{}',
  output_schema TEXT NOT NULL DEFAULT '{}',
  is_featured INTEGER DEFAULT 0,
  is_official INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft', 'published', 'archived')),
  author_user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_sop_installations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  sop_template_id TEXT NOT NULL,
  config_overrides TEXT,
  custom_name TEXT,
  notes TEXT,
  total_runs INTEGER DEFAULT 0,
  total_credits_spent INTEGER DEFAULT 0,
  installed_at INTEGER NOT NULL,
  last_run_at INTEGER,
  UNIQUE(user_id, sop_template_id)
);

CREATE TABLE IF NOT EXISTS sop_executions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  sop_template_id TEXT NOT NULL,
  installation_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'paused', 'completed', 'failed')),
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  error_message TEXT,
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER NOT NULL,
  step_results TEXT DEFAULT '[]',
  credits_used INTEGER DEFAULT 0,
  started_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sop_exec_user ON sop_executions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sop_exec_template ON sop_executions(sop_template_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sop_install_user ON user_sop_installations(user_id, org_id);
CREATE INDEX IF NOT EXISTS idx_sop_templates_category ON sop_templates(category, status);
CREATE INDEX IF NOT EXISTS idx_sop_templates_slug ON sop_templates(slug);
