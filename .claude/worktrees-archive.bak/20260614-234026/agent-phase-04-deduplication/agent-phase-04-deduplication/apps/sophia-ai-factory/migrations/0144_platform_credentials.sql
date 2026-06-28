-- Multi-channel publishing: OAuth credentials + publish tracking
CREATE TABLE IF NOT EXISTS platform_credentials (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TEXT,
  platform_user_id TEXT,
  platform_channel_name TEXT,
  scopes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_platform_credentials_user ON platform_credentials(user_id);

CREATE TABLE IF NOT EXISTS video_publishes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  platform_video_id TEXT,
  status TEXT DEFAULT 'pending',
  scheduled_at TEXT,
  published_at TEXT,
  error_message TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_video_publishes_user ON video_publishes(user_id);
CREATE INDEX IF NOT EXISTS idx_video_publishes_status ON video_publishes(status);
