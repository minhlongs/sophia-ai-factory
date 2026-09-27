-- 0324_omniversal_clearing_house_and_multilateral_netting.sql
-- Gate 15: $250,000,000 MRR ($3.0B ARR, 1,000,000 Paid Customers)
-- Pillar 1: Omniversal Multi-Asset Autonomous Clearing House & $2.5B Inter-Galactic Liquidity Mesh

-- 1. Real-Time Gross Settlement (RTGS) Clearing Sessions
CREATE TABLE IF NOT EXISTS rtgs_clearing_sessions (
  id TEXT PRIMARY KEY,
  session_ref TEXT NOT NULL UNIQUE, -- e.g. RTGS_OMNI_2026_SESSION_001
  source_participant_id TEXT NOT NULL,
  target_participant_id TEXT NOT NULL,
  asset_currency TEXT NOT NULL CHECK(asset_currency IN ('USD', 'EUR', 'SGD', 'JPY', 'GBP', 'SSDR', 'GEAC')),
  gross_amount_cents INTEGER NOT NULL,
  priority_tier TEXT NOT NULL CHECK(priority_tier IN ('CRITICAL_SYSTEMIC', 'HIGH_INSTITUTIONAL', 'STANDARD_COMMERCIAL')) DEFAULT 'STANDARD_COMMERCIAL',
  settlement_status TEXT NOT NULL CHECK(settlement_status IN ('QUEUED', 'EARMARKED_RESERVE', 'FINALIZED_IRREVOCABLE', 'REJECTED_INSUFFICIENT_LIQUIDITY')) DEFAULT 'QUEUED',
  execution_latency_micros INTEGER NOT NULL DEFAULT 45,
  clearing_receipt_hash TEXT NOT NULL,
  settled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_rtgs_status ON rtgs_clearing_sessions(settlement_status, asset_currency);

-- 2. Multilateral Netting Batches (Graph-compressed netting cycles)
CREATE TABLE IF NOT EXISTS multilateral_netting_batches (
  id TEXT PRIMARY KEY,
  batch_ref TEXT NOT NULL UNIQUE,
  cycle_interval_seconds INTEGER NOT NULL DEFAULT 60,
  gross_flow_count INTEGER NOT NULL,
  gross_volume_cents INTEGER NOT NULL,
  net_settlement_volume_cents INTEGER NOT NULL,
  compression_ratio_pct REAL NOT NULL, -- e.g. 94.6% compression
  participant_count INTEGER NOT NULL,
  netting_status TEXT NOT NULL CHECK(netting_status IN ('ACCUMULATING', 'GRAPH_SOLVED', 'NET_EXECUTED', 'NET_ABORTED')) DEFAULT 'ACCUMULATING',
  graph_solution_hash TEXT NOT NULL,
  executed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 3. Basel V Solvency Snapshots ($2.5B Backing Pool Supervision)
CREATE TABLE IF NOT EXISTS basel_v_solvency_snapshots (
  id TEXT PRIMARY KEY,
  audit_cycle TEXT NOT NULL UNIQUE, -- e.g. 2026-OMNIVERSE-SCALE
  common_equity_tier_1_cents INTEGER NOT NULL,
  total_risk_exposure_cents INTEGER NOT NULL,
  cet1_ratio_bps INTEGER NOT NULL, -- e.g. 1850 (18.50% - min 18.00%)
  liquidity_coverage_ratio_bps INTEGER NOT NULL, -- e.g. 26000 (260.00% - min 250%)
  net_stable_funding_ratio_bps INTEGER NOT NULL, -- e.g. 14000 (140.00% - min 135%)
  total_liquidity_buffer_cents INTEGER NOT NULL DEFAULT 250000000000, -- $2.5B in cents
  stress_test_survival_days INTEGER NOT NULL DEFAULT 120, -- min 90 days required
  is_solvent INTEGER NOT NULL DEFAULT 1 CHECK(is_solvent IN (0, 1)),
  supervisory_signature TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 4. Sovereign Omniversal Reserves Distribution
CREATE TABLE IF NOT EXISTS sovereign_omniversal_reserves (
  id TEXT PRIMARY KEY,
  vault_code TEXT NOT NULL UNIQUE,
  vault_location TEXT NOT NULL CHECK(vault_location IN ('FED_NEW_YORK', 'ECB_FRANKFURT', 'MAS_SINGAPORE', 'SNB_ZURICH', 'ORBITAL_LAGRANGE_VAULT')),
  allocated_capital_cents INTEGER NOT NULL,
  haircut_adjusted_valuation_cents INTEGER NOT NULL,
  primary_asset_type TEXT NOT NULL CHECK(primary_asset_type IN ('SOVEREIGN_BONDS', 'PHYSICAL_GOLD', 'SSDR_BASKET', 'TIER_1_EQUITIES', 'GEAC_COMPUTE_CREDITS')),
  last_rebalanced_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
