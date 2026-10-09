/**
 * Multi-Asset Clearing DB Row Interfaces
 *
 * Layer: seed/types
 */

import type {
  BatchCycle,
  ClearingAsset,
  ClearingBatchStatus,
  ConsensusProtocol,
  PoolStatus,
  ReconciliationStatus,
  SettlementType,
} from './constants-enums';

export interface ClearingLiquidityPoolRow {
  id: string;
  pool_code: string;
  asset_symbol: ClearingAsset;
  pool_name: string;
  total_reserve_amount: number;
  available_reserve_amount: number;
  locked_reserve_amount: number;
  target_reserve_amount: number;
  min_reserve_threshold: number;
  max_slippage_pct: number;
  virtual_liquidity_k: number;
  fee_tier_bps: number;
  rebalance_threshold_pct: number;
  daily_settlement_volume: number;
  status: PoolStatus;
  last_rebalanced_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface CrossBorderClearingBatchRow {
  id: string;
  batch_reference: string;
  batch_cycle: BatchCycle;
  source_asset: ClearingAsset;
  target_asset: ClearingAsset;
  gross_amount: number;
  net_cleared_amount: number;
  clearing_fee_amount: number;
  slippage_realized_pct: number;
  settlement_type: SettlementType;
  reconciliation_status: ReconciliationStatus;
  banking_partner_ref: string | null;
  iso20022_message_id: string | null;
  participant_count: number;
  pool_id: string | null;
  status: ClearingBatchStatus;
  merkle_root_hash: string | null;
  settled_at: number | null;
  reconciled_at: number | null;
  metadata_json: string;
  created_at: number;
  updated_at: number;
}

export interface SwarmV2ConsensusStateRow {
  id: string;
  term: number;
  leader_node_id: string | null;
  consensus_protocol: ConsensusProtocol;
  cluster_epoch: number;
  view_number: number;
  commit_index: number;
  last_applied_index: number;
  quorum_size: number;
  active_voters_count: number;
  byzantine_tolerance_f: number;
  avg_heartbeat_latency_ms: number;
  p99_heartbeat_latency_ms: number;
  is_quorum_healthy: number; // 0 | 1
  split_brain_detected: number; // 0 | 1
  last_leader_election_at: number;
  last_heartbeat_round_at: number;
  membership_nodes_json: string;
  audit_state_hash: string;
  updated_at: number;
}
