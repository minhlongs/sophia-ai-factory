-- Migration: 0023-user-wallets-payouts
-- User wallet materialized balance table + payout records + payout settings

CREATE TABLE IF NOT EXISTS user_wallets (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  balance_pending REAL NOT NULL DEFAULT 0,        -- in clearance (60-day hold)
  balance_available REAL NOT NULL DEFAULT 0,      -- payable now
  balance_paid_out REAL NOT NULL DEFAULT 0,       -- lifetime paid
  currency TEXT NOT NULL DEFAULT 'USD',
  last_rebuilt_at INTEGER,                         -- Unix seconds
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  method TEXT NOT NULL CHECK (method IN ('usdt_trc20','usdt_erc20','bank_transfer','other')),
  reference TEXT,                                  -- txid for crypto, ref# for bank
  notes TEXT,
  paid_by_admin TEXT NOT NULL,                     -- admin user_id who approved
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payouts_user ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_created ON payouts(created_at DESC);

-- User payout method preferences (KYC-light: just save preferred wallet)
CREATE TABLE IF NOT EXISTS user_payout_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  preferred_method TEXT CHECK (preferred_method IN ('usdt_trc20','usdt_erc20','bank_transfer')),
  -- TODO(M+1): payout_address contains PII (USDT wallet/bank acct). Before any code WRITES to this column,
  -- migrate to encryption-at-rest using @/lib/byok-encryption. Currently table is UNUSED — no live PII at risk.
  payout_address TEXT,                             -- crypto wallet OR bank account number
  payout_address_verified INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);
