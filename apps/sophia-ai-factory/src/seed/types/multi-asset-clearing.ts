/**
 * Multi-Asset Settlement, Liquidity Pools & Swarm v2 Raft-BFT Consensus Types
 *
 * Layer: seed/types (Foundational — zero upper layer imports, zero runtime side effects)
 * Standard: Gate 10 $5M MRR Scale / SEC IPO Readiness
 *
 * @module seed/types/multi-asset-clearing
 */

export const CLEARING_ASSETS = ['USDT', 'USDC', 'EUR', 'JPY', 'SGD', 'VND', 'USD'] as const;
export type ClearingAsset = (typeof CLEARING_ASSETS)[number];

export const POOL_STATUSES = ['active', 'rebalancing', 'depleted', 'halted', 'emergency_pause'] as const;
export type PoolStatus = (typeof POOL_STATUSES)[number];

export const BATCH_CYCLES = ['instant_rtgs', 'hourly_netting', 'eod_reconciliation'] as const;
export type BatchCycle = (typeof BATCH_CYCLES)[number];

export const SETTLEMENT_TYPES = ['T0_RTGS', 'NET_DEFERRED', 'INSTANT_CRYPTO'] as const;
export type SettlementType = (typeof SETTLEMENT_TYPES)[number];

export const RECONCILIATION_STATUSES = ['pending', 'matched', 'discrepancy', 'manually_resolved', 'reconciled'] as const;
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

export const CLEARING_BATCH_STATUSES = ['queued', 'processing', 'cleared', 'reconciled', 'settled', 'failed', 'rejected'] as const;
export type ClearingBatchStatus = (typeof CLEARING_BATCH_STATUSES)[number];

export const CONSENSUS_PROTOCOLS = ['RAFT_BFT', 'PBFT_FAST', 'RAFT_FAILOVER'] as const;
export type ConsensusProtocol = (typeof CONSENSUS_PROTOCOLS)[number];

/** Strict invariant: Maximum slippage tolerance is capped at 0.05% (5 basis points) */
export const MAX_SLIPPAGE_TOLERANCE_PCT = 0.05;

/** Sub-10ms heartbeat latency target for Raft-BFT consensus */
export const SUB_10MS_HEARTBEAT_THRESHOLD_MS = 10.0;

// ── Database Row Interfaces ──────────────────────────────────────────────────

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

// ── Domain Types ─────────────────────────────────────────────────────────────

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

// ── Operational Inputs & Outputs ─────────────────────────────────────────────

export interface SwapQuoteInput {
  sourceAsset: ClearingAsset;
  targetAsset: ClearingAsset;
  sourceAmount: number;
  maxAcceptableSlippagePct?: number; // Defaults to 0.05%
}

export interface SwapQuoteResult {
  sourceAsset: ClearingAsset;
  targetAsset: ClearingAsset;
  sourceAmount: number;
  targetAmount: number;
  effectiveRate: number;
  marketRate: number;
  slippagePct: number;
  clearingFeeAmount: number;
  slippageAcceptable: boolean;
  recommendedPoolId: string;
  routeLegs: Array<{ from: ClearingAsset; to: ClearingAsset; rate: number }>;
}

export interface ExecuteClearingBatchInput {
  sourceAsset: ClearingAsset;
  targetAsset: ClearingAsset;
  grossAmount: number;
  settlementType?: SettlementType;
  bankingPartnerRef?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface ClearingExecutionResult {
  success: boolean;
  batchId: string;
  batchReference: string;
  sourceAsset: ClearingAsset;
  targetAsset: ClearingAsset;
  grossAmount: number;
  netClearedAmount: number;
  clearingFeeAmount: number;
  slippageRealizedPct: number;
  iso20022MessageId: string;
  merkleRootHash: string;
  settlementType: SettlementType;
  status: ClearingBatchStatus;
  reconciliationStatus: ReconciliationStatus;
  settledAt: number;
  error?: string;
}

export interface ReconcileBatchInput {
  batchReference: string;
  externalStatementRef: string;
  settledAmount: number;
  settledCurrency: ClearingAsset;
  reconciliationNotes?: string;
}

export interface ReconciliationResult {
  success: boolean;
  batchReference: string;
  previousStatus: ReconciliationStatus;
  newStatus: ReconciliationStatus;
  discrepancyDelta?: number;
  matched: boolean;
  reconciledAt: number;
  error?: string;
}

export interface HeartbeatTelemetryV2Input {
  nodeId: string;
  roundTripLatencyMs: number;
  term: number;
  commitIndex: number;
  isVoteGranted?: boolean;
}

export interface ConsensusTelemetryResult {
  acknowledged: boolean;
  term: number;
  leaderId: string | null;
  avgHeartbeatLatencyMs: number;
  p99HeartbeatLatencyMs: number;
  isSub10ms: boolean;
  isQuorumHealthy: boolean;
  splitBrainDetected: boolean;
}

export interface ClearingActionError {
  code: string;
  message: string;
}

// ── ISO 20022 Message Models ─────────────────────────────────────────────────

export interface Iso20022Pacs008Message {
  messageDefinitionIdentifier: 'pacs.008.001.10';
  groupHeader: {
    messageId: string;
    creationDateTime: string;
    numberOfTransactions: number;
    settlementInformation: {
      settlementMethod: 'CLRG';
      clearingSystem: 'SOPHIA-RTGS-MESH';
    };
  };
  creditTransferTransactionInformation: {
    paymentIdentification: {
      instructionId: string;
      endToEndId: string;
      uetr: string;
    };
    interbankSettlementAmount: {
      currency: ClearingAsset;
      amount: number;
    };
    interbankSettlementDate: string; // YYYY-MM-DD
    chargeBearer: 'SHAR';
    debtor: {
      name: string;
      identification: string;
    };
    creditor: {
      name: string;
      identification: string;
    };
    remittanceInformation: {
      unstructured: string;
    };
  };
}

export interface Iso20022Camt053StatementItem {
  entryReference: string;
  amount: number;
  currency: ClearingAsset;
  creditDebitIndicator: 'CRDT' | 'DBIT';
  status: 'BOOK';
  bookingDate: string;
  bankTransactionCode: string;
  proprietaryRef: string;
}

export interface Iso20022Camt053Message {
  messageDefinitionIdentifier: 'camt.053.001.10';
  groupHeader: {
    messageId: string;
    creationDateTime: string;
    accountServicer: string;
  };
  statement: {
    statementId: string;
    electronicSequenceNumber: number;
    creationDateTime: string;
    accountIdentification: string;
    balance: {
      type: 'CLBD';
      amount: number;
      currency: ClearingAsset;
      date: string;
    };
    entries: Iso20022Camt053StatementItem[];
  };
}

// ── Multilateral Netting Models ──────────────────────────────────────────────

export interface BilateralTransferLeg {
  fromParticipantId: string;
  toParticipantId: string;
  asset: ClearingAsset;
  amount: number;
}

export interface NettingParticipantSummary {
  participantId: string;
  asset: ClearingAsset;
  grossPayable: number;
  grossReceivable: number;
  netSettlementAmount: number; // positive = receives, negative = pays
}

export interface MultilateralNettingMatrix {
  cycleId: string;
  asset: ClearingAsset;
  totalGrossVolume: number;
  totalNetVolume: number;
  compressionRatioPct: number;
  zeroSumBalanced: boolean;
  participantSummaries: NettingParticipantSummary[];
  settlementBatchIds: string[];
}

// ── Swarm v2 PBFT & Partition Models ─────────────────────────────────────────

export interface SwarmNodeHealth {
  nodeId: string;
  region: 'apac' | 'us' | 'eu' | 'global';
  status: 'active' | 'degraded' | 'isolated' | 'draining' | 'offline';
  lastHeartbeatAt: number;
  avgLatencyMs: number;
  term: number;
  commitIndex: number;
}

export interface PartitionArbitrationResult {
  splitBrainDetected: boolean;
  majorityPartitionNodes: string[];
  minorityPartitionNodes: string[];
  isolatedNodes: string[];
  activeLeaderId: string | null;
  arbitrationAction: 'MAINTAIN_LEADER' | 'DEMOTE_AND_ISOLATE' | 'EMERGENCY_QUORUM_LOST';
}

export interface ConsensusCommitResult {
  committed: boolean;
  term: number;
  commitIndex: number;
  quorumSize: number;
  approvalsCollected: number;
  digest: string;
  auditStateHash: string;
}

export type PbftPhase = 'PRE_PREPARE' | 'PREPARE' | 'COMMIT';

export interface PbftMessage {
  phase: PbftPhase;
  viewNumber: number;
  sequenceNumber: number;
  proposalDigest: string;
  senderNodeId: string;
  signature: string;
  timestamp: number;
}

// ── Row Mappers ──────────────────────────────────────────────────────────────

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
