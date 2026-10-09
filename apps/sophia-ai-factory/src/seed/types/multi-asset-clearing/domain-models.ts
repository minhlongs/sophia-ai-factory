/**
 * Multi-Asset Clearing Domain Models & Row Mappers
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
import type {
  ClearingLiquidityPoolRow,
  CrossBorderClearingBatchRow,
  SwarmV2ConsensusStateRow,
} from './db-models';

export interface ClearingLiquidityPool {
  id: string;
  poolCode: string;
  assetSymbol: ClearingAsset;
  poolName: string;
  totalReserveAmount: number;
  availableReserveAmount: number;
  lockedReserveAmount: number;
  targetReserveAmount: number;
  minReserveThreshold: number;
  maxSlippagePct: number;
  virtualLiquidityK: number;
  feeTierBps: number;
  rebalanceThresholdPct: number;
  dailySettlementVolume: number;
  status: PoolStatus;
  lastRebalancedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CrossBorderClearingBatch {
  id: string;
  batchReference: string;
  batchCycle: BatchCycle;
  sourceAsset: ClearingAsset;
  targetAsset: ClearingAsset;
  grossAmount: number;
  netClearedAmount: number;
  clearingFeeAmount: number;
  slippageRealizedPct: number;
  settlementType: SettlementType;
  reconciliationStatus: ReconciliationStatus;
  bankingPartnerRef: string | null;
  iso20022MessageId: string | null;
  participantCount: number;
  poolId: string | null;
  status: ClearingBatchStatus;
  merkleRootHash: string | null;
  settledAt: number | null;
  reconciledAt: number | null;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface SwarmV2ConsensusState {
  id: string;
  term: number;
  leaderNodeId: string | null;
  consensusProtocol: ConsensusProtocol;
  clusterEpoch: number;
  viewNumber: number;
  commitIndex: number;
  lastAppliedIndex: number;
  quorumSize: number;
  activeVotersCount: number;
  byzantineToleranceF: number;
  avgHeartbeatLatencyMs: number;
  p99HeartbeatLatencyMs: number;
  isQuorumHealthy: boolean;
  splitBrainDetected: boolean;
  lastLeaderElectionAt: number;
  lastHeartbeatRoundAt: number;
  membershipNodes: string[];
  auditStateHash: string;
  updatedAt: number;
}

export function rowToClearingLiquidityPool(row: ClearingLiquidityPoolRow): ClearingLiquidityPool {
  return {
    id: row.id,
    poolCode: row.pool_code,
    assetSymbol: row.asset_symbol,
    poolName: row.pool_name,
    totalReserveAmount: Number(row.total_reserve_amount),
    availableReserveAmount: Number(row.available_reserve_amount),
    lockedReserveAmount: Number(row.locked_reserve_amount),
    targetReserveAmount: Number(row.target_reserve_amount),
    minReserveThreshold: Number(row.min_reserve_threshold),
    maxSlippagePct: Number(row.max_slippage_pct),
    virtualLiquidityK: Number(row.virtual_liquidity_k),
    feeTierBps: Number(row.fee_tier_bps),
    rebalanceThresholdPct: Number(row.rebalance_threshold_pct),
    dailySettlementVolume: Number(row.daily_settlement_volume),
    status: row.status,
    lastRebalancedAt: row.last_rebalanced_at ? Number(row.last_rebalanced_at) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function rowToCrossBorderClearingBatch(row: CrossBorderClearingBatchRow): CrossBorderClearingBatch {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(row.metadata_json || '{}') as Record<string, unknown>;
  } catch {
    metadata = {};
  }

  return {
    id: row.id,
    batchReference: row.batch_reference,
    batchCycle: row.batch_cycle,
    sourceAsset: row.source_asset,
    targetAsset: row.target_asset,
    grossAmount: Number(row.gross_amount),
    netClearedAmount: Number(row.net_cleared_amount),
    clearingFeeAmount: Number(row.clearing_fee_amount),
    slippageRealizedPct: Number(row.slippage_realized_pct),
    settlementType: row.settlement_type,
    reconciliationStatus: row.reconciliation_status,
    bankingPartnerRef: row.banking_partner_ref,
    iso20022MessageId: row.iso20022_message_id,
    participantCount: Number(row.participant_count),
    poolId: row.pool_id,
    status: row.status,
    merkleRootHash: row.merkle_root_hash,
    settledAt: row.settled_at ? Number(row.settled_at) : null,
    reconciledAt: row.reconciled_at ? Number(row.reconciled_at) : null,
    metadata,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function rowToSwarmV2ConsensusState(row: SwarmV2ConsensusStateRow): SwarmV2ConsensusState {
  let membershipNodes: string[] = [];
  try {
    membershipNodes = JSON.parse(row.membership_nodes_json || '[]') as string[];
  } catch {
    membershipNodes = [];
  }

  return {
    id: row.id,
    term: Number(row.term),
    leaderNodeId: row.leader_node_id,
    consensusProtocol: row.consensus_protocol,
    clusterEpoch: Number(row.cluster_epoch),
    viewNumber: Number(row.view_number),
    commitIndex: Number(row.commit_index),
    lastAppliedIndex: Number(row.last_applied_index),
    quorumSize: Number(row.quorum_size),
    activeVotersCount: Number(row.active_voters_count),
    byzantineToleranceF: Number(row.byzantine_tolerance_f),
    avgHeartbeatLatencyMs: Number(row.avg_heartbeat_latency_ms),
    p99HeartbeatLatencyMs: Number(row.p99_heartbeat_latency_ms),
    isQuorumHealthy: Boolean(row.is_quorum_healthy),
    splitBrainDetected: Boolean(row.split_brain_detected),
    lastLeaderElectionAt: Number(row.last_leader_election_at),
    lastHeartbeatRoundAt: Number(row.last_heartbeat_round_at),
    membershipNodes,
    auditStateHash: row.audit_state_hash,
    updatedAt: Number(row.updated_at),
  };
}
