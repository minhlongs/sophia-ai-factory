-- Proposals enhancements: add mission_id + niche columns
-- Re-create proposals table if it does not exist (SQLite local fallback)

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  mission_id TEXT,
  niche TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS proposals_user_idx ON proposals(user_id, created_at);
