CREATE TABLE IF NOT EXISTS user_streaks (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  streak_type TEXT NOT NULL CHECK(streak_type IN ('login_daily', 'video_weekly')),
  current_count INTEGER NOT NULL DEFAULT 0,
  longest_count INTEGER NOT NULL DEFAULT 0,
  last_activity_date TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_streaks_type
ON user_streaks(user_id, streak_type);
