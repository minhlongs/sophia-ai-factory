CREATE TABLE rnn_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL CHECK(channel IN ('youtube','tiktok','telegram','instagram','facebook')),
  content_hash TEXT,
  optimal_time INTEGER,
  confidence REAL DEFAULT 0.0,
  published_at INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','published','failed','cancelled')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_rnn_schedule_channel ON rnn_schedule(channel);
CREATE INDEX idx_rnn_schedule_status ON rnn_schedule(status);
CREATE INDEX idx_rnn_schedule_optimal ON rnn_schedule(optimal_time);
