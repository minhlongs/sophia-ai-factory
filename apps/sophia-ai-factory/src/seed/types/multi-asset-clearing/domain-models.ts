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

export {
  rowToClearingLiquidityPool,
  rowToCrossBorderClearingBatch,
  rowToSwarmV2ConsensusState,
} from './domain-row-mappers';

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
