-- Create campaign_checkpoints with column names matching code expectations
CREATE TABLE IF NOT EXISTS campaign_checkpoints (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  step TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  completed_at TEXT DEFAULT (datetime('now')),
  UNIQUE(campaign_id, step)
);
CREATE INDEX IF NOT EXISTS idx_checkpoints_campaign ON campaign_checkpoints(campaign_id);
