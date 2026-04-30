-- Migration 20260506: Revenue Split + Payouts (Phase 13) — D1 alias
-- Alias of 0038-revenue-split.sql for date-based migration systems

CREATE TABLE IF NOT EXISTS commission_ledger (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  affiliate_id TEXT NOT NULL,
  conversion_event_id TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  gross_amount_usd REAL NOT NULL,
  commission_pct REAL NOT NULL,
  commission_usd REAL NOT NULL,
  status TEXT CHECK(status IN ('pending','payable','paid','clawed_back','rejected')) NOT NULL,
  payable_at INTEGER NOT NULL,
  paid_at INTEGER,
  payout_batch_id TEXT,
  clawback_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(conversion_event_id)
);

CREATE TABLE IF NOT EXISTS payout_batches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  affiliate_id TEXT NOT NULL,
  total_usd REAL NOT NULL,
  ledger_count INTEGER NOT NULL,
  status TEXT CHECK(status IN ('queued','sending','confirmed','failed')) NOT NULL,
  payment_method TEXT NOT NULL,
  external_payment_id TEXT,
  network TEXT DEFAULT 'TRC20',
  recipient_addr_encrypted TEXT NOT NULL,
  test_payment_confirmed INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  finalized_at INTEGER
);

CREATE TABLE IF NOT EXISTS payout_methods (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  affiliate_id TEXT NOT NULL,
  method TEXT CHECK(method IN ('usdt_trc20','usdt_erc20','bank_account')) NOT NULL,
  recipient_addr_encrypted TEXT NOT NULL,
  display_label TEXT,
  is_default INTEGER DEFAULT 0,
  verified INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(tenant_id, affiliate_id, method, recipient_addr_encrypted)
);

CREATE INDEX IF NOT EXISTS idx_ledger_tenant_status ON commission_ledger(tenant_id, status, payable_at);
CREATE INDEX IF NOT EXISTS idx_ledger_affiliate ON commission_ledger(affiliate_id, status, payable_at);
CREATE INDEX IF NOT EXISTS idx_batch_affiliate ON payout_batches(affiliate_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_method_affiliate ON payout_methods(affiliate_id, is_default);
