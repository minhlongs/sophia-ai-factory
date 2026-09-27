-- Migration 0310: Autonomous Swarm 2.0 & Cross-Border Multi-Asset Clearing Mesh
-- Milestone: GATE 10 ($5,000,000 MRR Scale & Public Tech IPO Readiness)
-- Cloudflare D1 SQLite Standards: Strict foreign keys, millisecond Unix timestamps, and CHECK constraints.

PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. clearing_liquidity_pools
-- Multi-asset settlement liquidity pools: USDT, USDC, EUR, JPY, SGD, VND
-- Enforces maximum slippage threshold < 0.05% (5 basis points) and virtual reserve AMM.
-- ============================================================================
CREATE TABLE IF NOT EXISTS clearing_liquidity_pools (
  id TEXT PRIMARY KEY,
  pool_code TEXT NOT NULL UNIQUE,
  asset_symbol TEXT NOT NULL CHECK(asset_symbol IN ('USDT', 'USDC', 'EUR', 'JPY', 'SGD', 'VND')),
  pool_name TEXT NOT NULL,
  total_reserve_amount REAL NOT NULL DEFAULT 0.0 CHECK(total_reserve_amount >= 0.0),
  available_reserve_amount REAL NOT NULL DEFAULT 0.0 CHECK(available_reserve_amount >= 0.0),
  locked_reserve_amount REAL NOT NULL DEFAULT 0.0 CHECK(locked_reserve_amount >= 0.0),
  target_reserve_amount REAL NOT NULL DEFAULT 0.0 CHECK(target_reserve_amount >= 0.0),
  min_reserve_threshold REAL NOT NULL DEFAULT 0.0 CHECK(min_reserve_threshold >= 0.0),
  max_slippage_pct REAL NOT NULL DEFAULT 0.05 CHECK(max_slippage_pct > 0.0 AND max_slippage_pct <= 0.05),
  virtual_liquidity_k REAL NOT NULL DEFAULT 0.0 CHECK(virtual_liquidity_k >= 0.0),
  fee_tier_bps INTEGER NOT NULL DEFAULT 2 CHECK(fee_tier_bps >= 0 AND fee_tier_bps <= 50),
  rebalance_threshold_pct REAL NOT NULL DEFAULT 15.0 CHECK(rebalance_threshold_pct >= 1.0 AND rebalance_threshold_pct <= 50.0),
  daily_settlement_volume REAL NOT NULL DEFAULT 0.0 CHECK(daily_settlement_volume >= 0.0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'rebalancing', 'depleted', 'halted', 'emergency_pause')),
  last_rebalanced_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_clp_asset_status ON clearing_liquidity_pools(asset_symbol, status);
CREATE INDEX IF NOT EXISTS idx_clp_status ON clearing_liquidity_pools(status);
CREATE INDEX IF NOT EXISTS idx_clp_reserves ON clearing_liquidity_pools(available_reserve_amount, min_reserve_threshold);

-- ============================================================================
-- 2. cross_border_clearing_batches
-- Multi-currency T+0 real-time gross settlement (RTGS) batches with banking reconciliation.
-- Supports cryptographic Merkle commitment and ISO 20022 message tracking.
-- ============================================================================
CREATE TABLE IF NOT EXISTS cross_border_clearing_batches (
  id TEXT PRIMARY KEY,
  batch_reference TEXT NOT NULL UNIQUE,
  batch_cycle TEXT NOT NULL CHECK(batch_cycle IN ('instant_rtgs', 'hourly_netting', 'eod_reconciliation')),
  source_asset TEXT NOT NULL CHECK(source_asset IN ('USDT', 'USDC', 'EUR', 'JPY', 'SGD', 'VND', 'USD')),
  target_asset TEXT NOT NULL CHECK(target_asset IN ('USDT', 'USDC', 'EUR', 'JPY', 'SGD', 'VND', 'USD')),
  gross_amount REAL NOT NULL CHECK(gross_amount >= 0.0),
  net_cleared_amount REAL NOT NULL CHECK(net_cleared_amount >= 0.0),
  clearing_fee_amount REAL NOT NULL DEFAULT 0.0 CHECK(clearing_fee_amount >= 0.0),
  slippage_realized_pct REAL NOT NULL DEFAULT 0.0 CHECK(slippage_realized_pct >= 0.0 AND slippage_realized_pct <= 0.05),
  settlement_type TEXT NOT NULL DEFAULT 'T0_RTGS' CHECK(settlement_type IN ('T0_RTGS', 'NET_DEFERRED', 'INSTANT_CRYPTO')),
  reconciliation_status TEXT NOT NULL DEFAULT 'pending' CHECK(reconciliation_status IN ('pending', 'matched', 'discrepancy', 'manually_resolved', 'reconciled')),
  banking_partner_ref TEXT,
  iso20022_message_id TEXT,
  participant_count INTEGER NOT NULL DEFAULT 1 CHECK(participant_count >= 1),
  pool_id TEXT REFERENCES clearing_liquidity_pools(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'processing', 'cleared', 'reconciled', 'settled', 'failed', 'rejected')),
  merkle_root_hash TEXT,
  settled_at INTEGER,
  reconciled_at INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cbcb_ref ON cross_border_clearing_batches(batch_reference);
CREATE INDEX IF NOT EXISTS idx_cbcb_status_cycle ON cross_border_clearing_batches(status, batch_cycle);
CREATE INDEX IF NOT EXISTS idx_cbcb_assets ON cross_border_clearing_batches(source_asset, target_asset);
CREATE INDEX IF NOT EXISTS idx_cbcb_reconciliation ON cross_border_clearing_batches(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_cbcb_created ON cross_border_clearing_batches(created_at DESC);

-- ============================================================================
-- 3. swarm_v2_consensus_state
-- Distributed Raft-BFT consensus state for autonomous swarm with sub-10ms heartbeat latency.
-- ============================================================================
CREATE TABLE IF NOT EXISTS swarm_v2_consensus_state (
  id TEXT PRIMARY KEY,
  term INTEGER NOT NULL DEFAULT 0 CHECK(term >= 0),
  leader_node_id TEXT REFERENCES autonomous_swarm_nodes(id) ON DELETE SET NULL,
  consensus_protocol TEXT NOT NULL DEFAULT 'RAFT_BFT' CHECK(consensus_protocol IN ('RAFT_BFT', 'PBFT_FAST', 'RAFT_FAILOVER')),
  cluster_epoch INTEGER NOT NULL DEFAULT 1 CHECK(cluster_epoch >= 1),
  view_number INTEGER NOT NULL DEFAULT 0 CHECK(view_number >= 0),
  commit_index INTEGER NOT NULL DEFAULT 0 CHECK(commit_index >= 0),
  last_applied_index INTEGER NOT NULL DEFAULT 0 CHECK(last_applied_index >= 0),
  quorum_size INTEGER NOT NULL DEFAULT 3 CHECK(quorum_size >= 1),
  active_voters_count INTEGER NOT NULL DEFAULT 1 CHECK(active_voters_count >= 1),
  byzantine_tolerance_f INTEGER NOT NULL DEFAULT 1 CHECK(byzantine_tolerance_f >= 0),
  avg_heartbeat_latency_ms REAL NOT NULL DEFAULT 0.0 CHECK(avg_heartbeat_latency_ms >= 0.0),
  p99_heartbeat_latency_ms REAL NOT NULL DEFAULT 0.0 CHECK(p99_heartbeat_latency_ms >= 0.0),
  is_quorum_healthy INTEGER NOT NULL DEFAULT 1 CHECK(is_quorum_healthy IN (0, 1)),
  split_brain_detected INTEGER NOT NULL DEFAULT 0 CHECK(split_brain_detected IN (0, 1)),
  last_leader_election_at INTEGER NOT NULL,
  last_heartbeat_round_at INTEGER NOT NULL,
  membership_nodes_json TEXT NOT NULL DEFAULT '[]',
  audit_state_hash TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_svcs_leader ON swarm_v2_consensus_state(leader_node_id);
CREATE INDEX IF NOT EXISTS idx_svcs_term_epoch ON swarm_v2_consensus_state(term, cluster_epoch);
CREATE INDEX IF NOT EXISTS idx_svcs_updated ON swarm_v2_consensus_state(updated_at DESC);

-- ============================================================================
-- 4. Seed Canonical Baseline Multi-Asset Liquidity Pools & Consensus State
-- ============================================================================
INSERT OR IGNORE INTO clearing_liquidity_pools (
  id, pool_code, asset_symbol, pool_name, total_reserve_amount, available_reserve_amount,
  locked_reserve_amount, target_reserve_amount, min_reserve_threshold, max_slippage_pct,
  virtual_liquidity_k, fee_tier_bps, rebalance_threshold_pct, status, created_at, updated_at
) VALUES
(
  'pool_usdt_primary', 'LP-USDT', 'USDT', 'Global Primary USDT Settlement Pool',
  2500000.0, 2500000.0, 0.0, 2500000.0, 250000.0, 0.01, 6250000000000.0, 2, 15.0, 'active',
  (strftime('%s', 'now') * 1000), (strftime('%s', 'now') * 1000)
),
(
  'pool_usdc_primary', 'LP-USDC', 'USDC', 'Global Primary USDC Settlement Pool',
  3000000.0, 3000000.0, 0.0, 3000000.0, 300000.0, 0.01, 9000000000000.0, 2, 15.0, 'active',
  (strftime('%s', 'now') * 1000), (strftime('%s', 'now') * 1000)
),
(
  'pool_eur_primary', 'LP-EUR', 'EUR', 'European SEPA Instant EUR Liquidity Pool',
  1800000.0, 1800000.0, 0.0, 1800000.0, 180000.0, 0.02, 3240000000000.0, 3, 15.0, 'active',
  (strftime('%s', 'now') * 1000), (strftime('%s', 'now') * 1000)
),
(
  'pool_jpy_primary', 'LP-JPY', 'JPY', 'Tokyo Financial JPY Settlement Pool',
  450000000.0, 450000000.0, 0.0, 450000000.0, 45000000.0, 0.03, 202500000000000000.0, 3, 15.0, 'active',
  (strftime('%s', 'now') * 1000), (strftime('%s', 'now') * 1000)
),
(
  'pool_sgd_primary', 'LP-SGD', 'SGD', 'Singapore PayNow / FAST SGD Liquidity Pool',
  1500000.0, 1500000.0, 0.0, 1500000.0, 150000.0, 0.02, 2250000000000.0, 2, 15.0, 'active',
  (strftime('%s', 'now') * 1000), (strftime('%s', 'now') * 1000)
),
(
  'pool_vnd_primary', 'LP-VND', 'VND', 'Vietnam NAPAS VietQR VND Liquidity Pool',
  35000000000.0, 35000000000.0, 0.0, 35000000000.0, 3500000000.0, 0.04, 1225000000000000000000.0, 4, 15.0, 'active',
  (strftime('%s', 'now') * 1000), (strftime('%s', 'now') * 1000)
);

INSERT OR IGNORE INTO swarm_v2_consensus_state (
  id, term, leader_node_id, consensus_protocol, cluster_epoch, view_number,
  commit_index, last_applied_index, quorum_size, active_voters_count,
  byzantine_tolerance_f, avg_heartbeat_latency_ms, p99_heartbeat_latency_ms,
  is_quorum_healthy, split_brain_detected, last_leader_election_at,
  last_heartbeat_round_at, membership_nodes_json, audit_state_hash, updated_at
) VALUES (
  'state_mesh_v2_global',
  1,
  'node_apac_coordinator_01',
  'RAFT_BFT',
  1,
  0,
  100,
  100,
  3,
  5,
  1,
  4.35,
  8.12,
  1,
  0,
  (strftime('%s', 'now') * 1000),
  (strftime('%s', 'now') * 1000),
  '["node_apac_coordinator_01", "node_apac_sales_01", "node_apac_healer_01", "node_us_sales_01", "node_eu_healer_01"]',
  '0000000000000000000000000000000000000000000000000000000000000000',
  (strftime('%s', 'now') * 1000)
);
