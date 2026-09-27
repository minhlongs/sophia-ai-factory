-- 0321_interstellar_central_bank_cls_and_liquidity_mesh.sql
-- Gate 14: $100,000,000 MRR ($1.2B ARR, 400,000 Paid Customers)
-- Pillar 1: Interstellar Central Bank CLS PvP & $1B Sovereign Liquidity Mesh

-- 1. Continuous Linked Settlement (CLS) Payment-versus-Payment (PvP) Sessions
CREATE TABLE IF NOT EXISTS cls_pvp_settlement_sessions (
  id TEXT PRIMARY KEY,
  session_ref TEXT NOT NULL UNIQUE, -- e.g. CLS_PVP_2026_SESSION_001
  leg_1_currency TEXT NOT NULL CHECK(leg_1_currency IN ('USD', 'EUR', 'SGD', 'JPY', 'GBP', 'SSDR')),
  leg_1_amount_cents INTEGER NOT NULL,
  leg_1_source_institution TEXT NOT NULL,
  leg_2_currency TEXT NOT NULL CHECK(leg_2_currency IN ('USD', 'EUR', 'SGD', 'JPY', 'GBP', 'SSDR')),
  leg_2_amount_cents INTEGER NOT NULL,
  leg_2_source_institution TEXT NOT NULL,
  exchange_rate REAL NOT NULL,
  atomic_status TEXT NOT NULL CHECK(atomic_status IN ('MATCHED', 'PENDING_DUAL_LEG_HOLD', 'EXECUTED_PVP', 'ROLLED_BACK_REVERSED')) DEFAULT 'MATCHED',
  clearing_hash_sha256 TEXT NOT NULL,
  settled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_cls_pvp_status ON cls_pvp_settlement_sessions(atomic_status, leg_1_currency, leg_2_currency);

-- 2. Dynamic Collateral Rehypothecation Allocations
CREATE TABLE IF NOT EXISTS rehypothecated_collateral_allocations (
  id TEXT PRIMARY KEY,
  allocation_ref TEXT NOT NULL UNIQUE,
  collateral_asset_type TEXT NOT NULL CHECK(collateral_asset_type IN ('US_TREASURY_BILLS', 'SOVEREIGN_GOLD_BULLION', 'SSDR_STABLE_BASKET', 'TIER_1_EQUITY_INDEX')),
  original_owner_id TEXT NOT NULL,
  pledged_value_cents INTEGER NOT NULL,
  rehypothecated_target_pool TEXT NOT NULL,
  haircut_percentage REAL NOT NULL DEFAULT 1.5,
  rehypothecation_tier INTEGER NOT NULL DEFAULT 1 CHECK(rehypothecation_tier BETWEEN 1 AND 3),
  is_ringfenced INTEGER NOT NULL DEFAULT 1 CHECK(is_ringfenced IN (0, 1)),
  last_audited_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 3. Basel IV Capital Adequacy Snapshots ($1B Backing Pool Supervision)
CREATE TABLE IF NOT EXISTS basel_iv_capital_adequacy_snapshots (
  id TEXT PRIMARY KEY,
  audit_quarter TEXT NOT NULL UNIQUE, -- e.g. 2026-Q3-CENTICORN
  tier_1_capital_cents INTEGER NOT NULL, -- Core Common Equity Tier 1 (CET1)
  risk_weighted_assets_cents INTEGER NOT NULL,
  cet1_ratio_bps INTEGER NOT NULL, -- e.g. 1750 (17.50% - min 16.50%)
  liquidity_coverage_ratio_bps INTEGER NOT NULL, -- e.g. 22500 (225.00% - min 200%)
  net_stable_funding_ratio_bps INTEGER NOT NULL, -- e.g. 14500 (145.00% - min 125%)
  sovereign_buffer_allocated_cents INTEGER NOT NULL DEFAULT 100000000000, -- $1B in cents
  is_compliant INTEGER NOT NULL DEFAULT 1 CHECK(is_compliant IN (0, 1)),
  snapshot_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 4. Sovereign Credit Facilities
CREATE TABLE IF NOT EXISTS sovereign_credit_facilities (
  id TEXT PRIMARY KEY,
  facility_code TEXT NOT NULL UNIQUE,
  central_bank_name TEXT NOT NULL,
  jurisdiction TEXT NOT NULL CHECK(jurisdiction IN ('US', 'EU', 'SG', 'CH', 'JP', 'UK', 'GLOBAL_SOVEREIGN')),
  max_standby_line_cents INTEGER NOT NULL, -- e.g. $500M line
  utilized_credit_cents INTEGER NOT NULL DEFAULT 0,
  overnight_funding_rate_bps INTEGER NOT NULL DEFAULT 35,
  collateral_pledged_cents INTEGER NOT NULL,
  facility_status TEXT NOT NULL CHECK(facility_status IN ('STANDBY_ACTIVE', 'DRAWING', 'FROZEN', 'TERMINATED')) DEFAULT 'STANDBY_ACTIVE',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
