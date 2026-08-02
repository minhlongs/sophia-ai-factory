CREATE TABLE apm_metric_definitions (
  name        TEXT PRIMARY KEY NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE apm_metrics (
  id           TEXT PRIMARY KEY NOT NULL,
  metric_name  TEXT NOT NULL,
  value        INTEGER NOT NULL,
  recorded_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (metric_name) REFERENCES apm_metric_definitions(name) ON DELETE CASCADE
);

CREATE INDEX idx_apm_metric_name ON apm_metrics(metric_name, recorded_at);

INSERT INTO apm_metric_definitions (name, description) VALUES
  ('deploy_bypasses',   'Deploy attestation bypasses used'),
  ('payment_failures',  'Payment processing failures'),
  ('quota_violations',  'Quota enforcement violations'),
  ('auth_failures',     'Authentication/authorization failures'),
  ('video_gen_errors',  'AI video generation errors');
