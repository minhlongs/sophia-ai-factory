-- User SOP Installations
-- Decouples template from per-user instance; allows customization + schedule

CREATE TABLE IF NOT EXISTS user_sop_installations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  customizations TEXT,            -- JSON: { playbook_md_override?, agents_yaml_override?, vars?, webhookSecret? }
  schedule_cron TEXT,             -- nullable for webhook-only SOPs
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at INTEGER,
  next_run_at INTEGER,
  run_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (template_id) REFERENCES sop_templates(id)
);

CREATE INDEX IF NOT EXISTS idx_sop_inst_user ON user_sop_installations(user_id);
CREATE INDEX IF NOT EXISTS idx_sop_inst_due ON user_sop_installations(enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_sop_inst_template ON user_sop_installations(template_id);
