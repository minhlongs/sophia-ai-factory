CREATE TABLE usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL REFERENCES agency(id),
  sub_tenant_id INTEGER,
  credits_used INTEGER NOT NULL,
  job_type TEXT,
  job_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX idx_usage_agency ON usage_log(agency_id);
CREATE INDEX idx_usage_created ON usage_log(created_at);
