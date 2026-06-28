CREATE TABLE IF NOT EXISTS beta_invites (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  email TEXT,
  commission_override_pct REAL NOT NULL DEFAULT 0.50,
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_beta_invites_code ON beta_invites(code);
CREATE INDEX IF NOT EXISTS idx_beta_invites_created_by ON beta_invites(created_by);
