-- Mission Engine v2: user-scoped missions for /api/v1/missions REST API
-- Uses separate table (engine_missions) to avoid conflict with existing org-scoped missions table

CREATE TABLE IF NOT EXISTS engine_missions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  command TEXT NOT NULL,
  params TEXT,  -- JSON
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','succeeded','failed','cancelled')),
  result TEXT,  -- JSON
  error TEXT,
  credits_used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  completed_at INTEGER,
  webhook_url TEXT,
  webhook_fired_at INTEGER
);

CREATE INDEX IF NOT EXISTS engine_missions_user_idx ON engine_missions(user_id, created_at);
CREATE INDEX IF NOT EXISTS engine_missions_status_idx ON engine_missions(status, created_at);
