CREATE TABLE IF NOT EXISTS compliance_metadata (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  content_id TEXT,
  user_id TEXT NOT NULL,
  compliance_type TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  platform TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  verified_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_compliance_execution ON compliance_metadata(execution_id);
CREATE INDEX IF NOT EXISTS idx_compliance_user ON compliance_metadata(user_id, compliance_type);
CREATE INDEX IF NOT EXISTS idx_compliance_type ON compliance_metadata(compliance_type, verified);
CREATE INDEX IF NOT EXISTS idx_compliance_platform ON compliance_metadata(platform, created_at DESC);
