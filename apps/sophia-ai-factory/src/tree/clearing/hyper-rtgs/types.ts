/**
 * Types and interfaces for Hyper RTGS Payment Validation & Multilateral Netting
 *
 * @module tree/clearing/hyper-rtgs/types
 */

export interface RtgsPaymentValidationParams {
  sourceParticipantId: string;
  targetParticipantId: string;
  assetCurrency: string;
  grossAmountCents: number;
  availableReserveCents: number;
  priorityTier?: string;
}

export interface RtgsPaymentEngineConfig {
  latency?: number;
  latencyKey?: 'executionLatencyNanos' | 'executionLatencyPicoseconds' | 'none';
  hashPrefix?: string;
  defaultPriorityTier?: string;
  requireParticipants?: boolean;
  allowSelfSettlement?: boolean;
  rejectStatus?: string;
  receiptHashFn?: (params: RtgsPaymentValidationParams, latency: number) => string;
  errorHashFn?: (reason: string, params: RtgsPaymentValidationParams, latency: number) => string;
  reserveDeficitReasonFn?: (params: RtgsPaymentValidationParams) => string;
}

export interface RtgsPaymentValidationResult {
  valid: boolean;
  status: string;
  executionLatencyNanos?: number;
  executionLatencyPicoseconds?: number;
  receiptHash: string;
  error?: string;
  reason?: string;
}

export interface NettingObligation {
  fromParticipantId: string;
  toParticipantId: string;
  amountCents: number;
  currency?: string;
}

export interface DirectionalNetTransfer {
  participantId: string;
  netPositionCents: number;
  direction: 'RECEIVE' | 'PAY' | 'SETTLED_FLAT';
}

export interface BilateralNetTransfer {
  from: string;
  to: string;
  currency: string;
  amountCents: number;
}

export interface MultilateralNettingContext {
  batchRef: string;
  grossFlowCount: number;
  grossVolumeCents: number;
  netSettlementVolumeCents: number;
  compressionRatioPct: number;
  hyperShardCount: number;
  currency: string;
  netPositions: Record<string, number>;
  netTransfersCount: number;
}

export interface MultilateralNettingConfig {
  currency?: string;
  hyperShardCount?: number;
  hashPrefix?: string;
  precision?: number;
  transferFormat?: 'directional' | 'debtor_creditor';
  batchRef?: string;
  batchRefPrefix?: string;
  solutionHashFn?: (ctx: MultilateralNettingContext) => string;
  emptyHashFn?: (ctx: MultilateralNettingContext) => string;
}

export interface MultilateralNettingResult {
  status?: string;
  nettingStatus?: 'NET_EXECUTED' | 'FAILED';
  batchRef?: string;
  hyperShardCount?: number;
  grossFlowCount: number;
  grossVolumeCents: number;
  netSettlementVolumeCents: number;
  compressionRatioPct: number;
  netPositions: Record<string, number>;
  netTransfers: BilateralNetTransfer[] | DirectionalNetTransfer[];
  graphSolutionHash?: string;
  transCosmicSolutionHash?: string;
  omniverseSolutionHash?: string;
}

export interface RtgsViolation {
  error: string;
  reason: string;
  receiptHash: string;
}
