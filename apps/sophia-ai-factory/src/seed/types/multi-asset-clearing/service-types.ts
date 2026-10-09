/**
 * Multi-Asset Clearing Service Input & Output Types
 *
 * Layer: seed/types
 */

import type {
  ClearingAsset,
  ClearingBatchStatus,
  ReconciliationStatus,
  SettlementType,
} from './constants-enums';

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
