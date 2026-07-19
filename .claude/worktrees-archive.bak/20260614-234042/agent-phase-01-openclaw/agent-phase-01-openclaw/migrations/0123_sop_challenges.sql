-- SOP Challenges — gamification for creator engagement

CREATE TABLE IF NOT EXISTS sop_challenges (
  id TEXT PRIMARY KEY,
  title_en TEXT NOT NULL,
  title_vi TEXT NOT NULL,
  description_en TEXT,
  description_vi TEXT,
  goal_type TEXT CHECK(goal_type IN ('sop_runs','sop_sales','commission_earned','sops_created')) NOT NULL,
  goal_value INTEGER NOT NULL,
  reward_type TEXT CHECK(reward_type IN ('badge','credits','commission_boost')) NOT NULL,
  reward_value TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  status TEXT CHECK(status IN ('upcoming','active','ended')) NOT NULL DEFAULT 'upcoming',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_challenge_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER,
  reward_claimed INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_status ON sop_challenges(status, ends_at);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_challenge_progress(user_id, challenge_id);
