-- Migration 0116: Fix user_sop_installations FK after sop_templates table recreation.
--
-- Migration 0059 recreated sop_templates via RENAME sop_templates_old -> DROP,
-- which left the child table FK pointing at "sop_templates_old" on production D1.
-- Any new SOP install then fails with: no such table: main.sop_templates_old.

PRAGMA foreign_keys = off;

CREATE TABLE IF NOT EXISTS user_sop_installations_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  customizations TEXT,
  schedule_cron TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at INTEGER,
  next_run_at INTEGER,
  run_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  config_values TEXT,
  FOREIGN KEY (template_id) REFERENCES sop_templates(id)
);

INSERT INTO user_sop_installations_new
  (id, user_id, template_id, customizations, schedule_cron, enabled,
   last_run_at, next_run_at, run_count, created_at, config_values)
SELECT
  id, user_id, template_id, customizations, schedule_cron, enabled,
  last_run_at, next_run_at, run_count, created_at, config_values
FROM user_sop_installations;

DROP TABLE user_sop_installations;
ALTER TABLE user_sop_installations_new RENAME TO user_sop_installations;

CREATE INDEX IF NOT EXISTS idx_sop_inst_user ON user_sop_installations(user_id);
CREATE INDEX IF NOT EXISTS idx_sop_inst_due ON user_sop_installations(enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_sop_inst_template ON user_sop_installations(template_id);

PRAGMA foreign_keys = on;
