/**
 * @file omniverse-hyper-rtgs-capital.ts
 * @layer seed/types
 * @description Seed types & scale constants for Gate 25: $500,000,000,000 MRR ($6,000.0B ARR / $6.0 Trillion ARR, 2,000,000,000 Paid Customers).
 * The Omniverse Infinite Singularity & Transcendental Absolute Continuum Matrix:
 * Omniverse Hyper-RTGS, Netting 11.0 & $5.0 Trillion Treasury Singularity.
 */

export {
  type BaselXvSolvencyStatus,
  type BaselXvSolvencySnapshot,
  type OmniverseVaultHub,
  ALL_OMNIVERSE_VAULT_HUBS,
  type OmniverseCollateralAsset,
  type OmniverseTreasuryReserve,
} from './omniverse-treasury-solvency-types';

export const GATE_25_SCALE_TARGETS = {
  MRR_TARGET_USD: 500_000_000_000,
  ARR_TARGET_USD: 6_000_000_000_000,
  ACTIVE_PAID_CUSTOMERS: 2_000_000_000,
  ARPU_USD: 250,
  NET_REVENUE_RETENTION_PERCENT: 210,
  TWENTY_NINES_UPTIME_PERCENT: 99.999999999999999999,
  SOVEREIGN_BUFFER_TARGET_USD: 5_000_000_000_000,
  SOVEREIGN_RESERVE_SINGULARITY_USD: 5_000_000_000_000,
  BASEL_XV_MIN_CET1_BPS: 4200, // 42.00%
  BASEL_XV_MIN_LCR_BPS: 120000, // 1200.00%
  BASEL_XV_MIN_NSFR_BPS: 45000, // 450.00%
  MIN_NETTING_COMPRESSION_RATIO_PCT: 99.999,
  MAX_SETTLEMENT_LATENCY_PICOSECONDS: 100, // target 75 ps (0.075 ns)
} as const;

export type OmniverseCurrency =
  | 'USD'
  | 'EUR'
  | 'SGD'
  | 'JPY'
  | 'GBP'
  | 'sSDR_V7'
  | 'USDT'
  | 'MULTIVERSE_CREDIT'
  | 'ZERO_POINT_ENERGY';

export type OmniversePriorityTier =
  | 'OMNIVERSE_EXPEDITE'
  | 'MULTIVERSE_INSTITUTIONAL'
  | 'STANDARD_MULTIVERSE';

export type OmniverseSettlementStatus =
  | 'QUEUED'
  | 'EARMARKED_RESERVE'
  | 'FINALIZED_IRREVOCABLE'
  | 'REJECTED_LIQUIDITY';

export interface OmniverseHyperRtgsSession {
  id?: string;
  sessionRef: string;
  sourceParticipantId: string;
  targetParticipantId: string;
  assetCurrency: OmniverseCurrency;
  grossAmountCents: number;
  priorityTier: OmniversePriorityTier;
  settlementStatus: OmniverseSettlementStatus;
  executionLatencyPicoseconds: number;
  clearingReceiptHash: string;
  settledAt?: string;
  createdAt?: string;
}

export interface OmniverseNettingObligation {
  fromParticipantId: string;
  toParticipantId: string;
  currency: OmniverseCurrency;
  amountCents: number;
  subShardId?: string;
}

export type OmniverseNettingStatus =
  | 'ACCUMULATING'
  | 'MULTIVERSE_SOLVED'
  | 'NET_EXECUTED'
  | 'NET_ABORTED';

export interface OmniverseNettingBatch {
  id?: string;
  batchRef: string;
  hyperShardCount: number;
  grossFlowCount: number;
  grossVolumeCents: number;
  netSettlementVolumeCents: number;
  compressionRatioPct: number;
  nettingStatus: OmniverseNettingStatus;
  multiverseSolutionHash: string;
  executedAt?: string;
  createdAt?: string;
}
