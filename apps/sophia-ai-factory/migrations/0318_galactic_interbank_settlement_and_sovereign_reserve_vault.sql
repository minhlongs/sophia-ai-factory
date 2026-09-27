-- 0318_galactic_interbank_settlement_and_sovereign_reserve_vault.sql
-- Gate 13: $50,000,000 MRR ($600M ARR, 200,000 Paid Customers)
-- Pillar 1: Galactic Inter-Bank Settlement & Sovereign Reserve Currency Vault (Swap Lines & sSDR)

-- 1. Sovereign Central Bank Swap Lines
CREATE TABLE IF NOT EXISTS sovereign_swap_lines (
  id TEXT PRIMARY KEY,
  line_code TEXT NOT NULL UNIQUE, -- e.g. SWAP_USD_EUR_001, SWAP_SGD_SSDR_002
  primary_central_bank TEXT NOT NULL, -- e.g. US_FED, ECB, MAS_SINGAPORE, BOJ, BANK_OF_ENGLAND, SOPHIA_SOVEREIGN_VAULT
  counterparty_central_bank TEXT NOT NULL,
  facility_type TEXT NOT NULL CHECK(facility_type IN ('BILATERAL', 'TRILATERAL', 'MULTILATERAL_STANDBY')),
  base_currency TEXT NOT NULL CHECK(base_currency IN ('USD', 'EUR', 'SGD', 'JPY', 'GBP', 'SSDR')),
  quote_currency TEXT NOT NULL CHECK(quote_currency IN ('USD', 'EUR', 'SGD', 'JPY', 'GBP', 'SSDR')),
  credit_limit_cents INTEGER NOT NULL, -- e.g. $10,000,000,000 (10B USD in cents)
  drawn_amount_cents INTEGER NOT NULL DEFAULT 0,
  interest_spread_bps INTEGER NOT NULL DEFAULT 25, -- 25 bps over OIS
  collateral_haircut_bps INTEGER NOT NULL DEFAULT 150, -- 1.5% haircut
  counterparty_rating TEXT NOT NULL CHECK(counterparty_rating IN ('AAA', 'AA_PLUS', 'AA', 'A_PLUS', 'SOVEREIGN_PRIME')),
  status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'SUSPENDED', 'SETTLING', 'EXPIRED')) DEFAULT 'ACTIVE',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sovereign_swap_status ON sovereign_swap_lines(status, base_currency, quote_currency);

-- 2. Sophia Synthetic SDR (sSDR) Multi-Currency Baskets
CREATE TABLE IF NOT EXISTS ssdr_currency_baskets (
  id TEXT PRIMARY KEY,
  basket_version TEXT NOT NULL UNIQUE, -- e.g. SSDR_2026_Q3
  usd_weight_bps INTEGER NOT NULL DEFAULT 4338, -- 43.38%
  eur_weight_bps INTEGER NOT NULL DEFAULT 2931, -- 29.31%
  cny_weight_bps INTEGER NOT NULL DEFAULT 1228, -- 12.28%
  jpy_weight_bps INTEGER NOT NULL DEFAULT 759,  -- 7.59%
  gbp_weight_bps INTEGER NOT NULL DEFAULT 744,  -- 7.44%
  calculated_index_cents INTEGER NOT NULL DEFAULT 135, -- $1.35 per 1 sSDR in cents
  total_ssdr_supply INTEGER NOT NULL DEFAULT 500000000, -- 500M sSDR
  reserve_backing_ratio_bps INTEGER NOT NULL DEFAULT 12500, -- 125.00% over-collateralized
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  last_rebalanced_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 3. Reserve Stabilization Events ($500M Liquidity Buffer Operations)
CREATE TABLE IF NOT EXISTS reserve_stabilization_events (
  id TEXT PRIMARY KEY,
  event_ref TEXT NOT NULL UNIQUE,
  operation_type TEXT NOT NULL CHECK(operation_type IN ('MINT_SSDR', 'BURN_SSDR', 'INJECT_USD_BUFFER', 'REBALANCE_CORRIDOR', 'ARBITRAGE_ABSORPTION')),
  currency TEXT NOT NULL CHECK(currency IN ('USD', 'EUR', 'SGD', 'JPY', 'GBP', 'SSDR')),
  amount_cents INTEGER NOT NULL,
  pre_stabilization_backing_bps INTEGER NOT NULL,
  post_stabilization_backing_bps INTEGER NOT NULL,
  clearing_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('COMMITTED', 'AUDITED', 'SETTLED')) DEFAULT 'COMMITTED',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_reserve_stabilization_created ON reserve_stabilization_events(created_at, operation_type);

-- 4. Galactic Liquidity Buffers
CREATE TABLE IF NOT EXISTS galactic_liquidity_buffers (
  id TEXT PRIMARY KEY,
  vault_identifier TEXT NOT NULL UNIQUE,
  jurisdiction TEXT NOT NULL CHECK(jurisdiction IN ('US_FEDERAL_RESERVE_NY', 'EURO_SYSTEM_FRANKFURT', 'MONETARY_AUTHORITY_SINGAPORE', 'SOPHIA_SWISS_VAULT')),
  allocated_target_cents INTEGER NOT NULL DEFAULT 12500000000, -- $125M per hub ($500M total across 4 hubs)
  available_balance_cents INTEGER NOT NULL,
  locked_escrow_cents INTEGER NOT NULL DEFAULT 0,
  health_factor REAL NOT NULL DEFAULT 1.0, -- > 0.95 required
  last_audit_proof_sha256 TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
