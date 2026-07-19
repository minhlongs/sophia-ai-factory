CREATE TABLE lottery_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  prize_1 TEXT NOT NULL,
  prize_2 TEXT NOT NULL,
  prize_3 TEXT NOT NULL,
  prize_4 TEXT NOT NULL,
  prize_5 TEXT NOT NULL,
  prize_6 TEXT NOT NULL,
  prize_7 TEXT NOT NULL,
  prize_8 TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_lottery_results_date ON lottery_results(date DESC);
