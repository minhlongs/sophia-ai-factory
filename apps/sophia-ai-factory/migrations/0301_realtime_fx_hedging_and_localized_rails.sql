-- Migration 0301: Real-Time Dynamic FX Hedging, Localized Payment Rails & Automated Tax Compliance
-- Milestone: $800,000 MRR Global Expansion Engine
-- Target: Cloudflare D1 (sophia-raas-db)

PRAGMA foreign_keys = ON;

-- 1. Real-Time FX Exchange Rates Ledger
CREATE TABLE IF NOT EXISTS fx_exchange_rates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  base_currency TEXT NOT NULL DEFAULT 'USD',
  target_currency TEXT NOT NULL CHECK (target_currency IN ('USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'CAD', 'VND', 'THB', 'IDR')),
  rate REAL NOT NULL,
  inverse_rate REAL NOT NULL,
  buffer_percentage REAL NOT NULL DEFAULT 0.015,
  hedged_rate REAL NOT NULL,
  source_provider TEXT NOT NULL CHECK (source_provider IN ('ECB', 'OPEN_EXCHANGE', 'KV_CACHE', 'BEDROCK_FALLBACK')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  valid_from INTEGER NOT NULL,
  valid_until INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_fx_rates_pair ON fx_exchange_rates(base_currency, target_currency, is_active);
CREATE INDEX IF NOT EXISTS idx_fx_rates_valid ON fx_exchange_rates(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_fx_rates_created ON fx_exchange_rates(created_at);

-- 2. Localized Payment Transactions Ledger
CREATE TABLE IF NOT EXISTS localized_payment_transactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual', 'one_time')),
  payment_rail TEXT NOT NULL CHECK (payment_rail IN ('SEPA_DIRECT_DEBIT', 'PROMPTPAY', 'PAYNOW', 'GRABPAY', 'PAYOS_VIETQR', 'NOWPAYMENTS_CRYPTO')),
  base_currency TEXT NOT NULL DEFAULT 'USD',
  base_amount_cents INTEGER NOT NULL,
  settlement_currency TEXT NOT NULL CHECK (settlement_currency IN ('USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'CAD', 'VND', 'THB', 'IDR', 'USDT', 'USDC')),
  settlement_amount REAL NOT NULL,
  fx_rate_applied REAL NOT NULL,
  fx_rate_id TEXT REFERENCES fx_exchange_rates(id),
  tax_jurisdiction TEXT NOT NULL DEFAULT 'NONE' CHECK (tax_jurisdiction IN ('EU_MOSS', 'SG_GST', 'VN_TT78', 'US_SALES', 'EXEMPT', 'NONE')),
  tax_rate REAL NOT NULL DEFAULT 0.0,
  tax_amount_cents INTEGER NOT NULL DEFAULT 0,
  tax_identifier TEXT,
  subtotal_amount REAL NOT NULL,
  total_amount REAL NOT NULL,
  rail_transaction_reference TEXT,
  qr_payload TEXT,
  mandate_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'authorized', 'completed', 'failed', 'refunded', 'charged_back', 'expired')),
  idempotency_key TEXT NOT NULL UNIQUE,
  error_code TEXT,
  error_message TEXT,
  settled_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lpt_idempotency ON localized_payment_transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_lpt_org ON localized_payment_transactions(org_id, status);
CREATE INDEX IF NOT EXISTS idx_lpt_rail_ref ON localized_payment_transactions(payment_rail, rail_transaction_reference);
CREATE INDEX IF NOT EXISTS idx_lpt_status ON localized_payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_lpt_created ON localized_payment_transactions(created_at);

-- 3. Dynamic FX Hedging Reserves
CREATE TABLE IF NOT EXISTS fx_hedging_reserves (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  transaction_id TEXT NOT NULL REFERENCES localized_payment_transactions(id) ON DELETE CASCADE,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  target_currency TEXT NOT NULL,
  base_amount_cents INTEGER NOT NULL,
  market_rate_at_quote REAL NOT NULL,
  hedged_rate_at_quote REAL NOT NULL,
  buffer_percent REAL NOT NULL DEFAULT 0.015,
  reserve_amount_cents INTEGER NOT NULL,
  reserve_amount_target REAL NOT NULL,
  market_rate_at_settlement REAL,
  variance_percent REAL,
  realized_pnl_cents INTEGER,
  reserve_status TEXT NOT NULL DEFAULT 'escrowed' CHECK (reserve_status IN ('escrowed', 'realized_gain', 'absorbed_loss', 'rebalanced', 'released')),
  settled_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_fxr_txn ON fx_hedging_reserves(transaction_id);
CREATE INDEX IF NOT EXISTS idx_fxr_status ON fx_hedging_reserves(reserve_status);
CREATE INDEX IF NOT EXISTS idx_fxr_target_cur ON fx_hedging_reserves(target_currency, created_at);
