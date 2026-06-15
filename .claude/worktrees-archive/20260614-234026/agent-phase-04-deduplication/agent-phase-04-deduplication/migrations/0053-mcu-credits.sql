-- MCU (Model Compute Units) credit system
-- Balance tracking per user + transaction ledger

CREATE TABLE IF NOT EXISTS user_mcu_balance (
  user_id TEXT PRIMARY KEY,
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  credits_total_purchased INTEGER NOT NULL DEFAULT 0,
  credits_total_used INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS mcu_transactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  mission_id TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS mcu_tx_user_idx ON mcu_transactions(user_id, created_at);
