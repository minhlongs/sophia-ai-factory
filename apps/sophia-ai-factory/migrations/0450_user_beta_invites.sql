CREATE TABLE IF NOT EXISTS user_beta_invites (
  user_id TEXT NOT NULL PRIMARY KEY,
  invite_code TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  approved_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
