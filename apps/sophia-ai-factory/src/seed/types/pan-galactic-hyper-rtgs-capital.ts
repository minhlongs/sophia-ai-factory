/**
 * @file pan-galactic-hyper-rtgs-capital.ts
 * @layer seed/types
 * @description Seed types & scale constants for Gate 24: $200,000,000,000 MRR ($2,400.0B ARR / $2.4 Trillion ARR, 800,000,000 Paid Customers).
 * The Pan-Galactic Infinite Singularity & Omnipresent Supreme Continuum Matrix:
 * Pan-Galactic Hyper-RTGS, Netting 10.0 & $2.0 Trillion Treasury Singularity.
 */

export {
  ALL_PAN_GALACTIC_VAULT_HUBS,
  type BaselXivSolvencyStatus,
  type BaselXivSolvencySnapshot,
  type PanGalacticVaultHub,
  type PanGalacticCollateralAsset,
  type PanGalacticTreasuryReserve,
} from './pan-galactic-solvency-vault';

export const GATE_24_SCALE_TARGETS = {
  MRR_TARGET_USD: 200_000_000_000,
  ARR_TARGET_USD: 2_400_000_000_000,
  ACTIVE_PAID_CUSTOMERS: 800_000_000,
  ARPU_USD: 250,
  NET_REVENUE_RETENTION_PERCENT: 205,
  NINETEEN_NINES_UPTIME_PERCENT: 99.99999999999999999,
  SOVEREIGN_BUFFER_TARGET_USD: 2_000_000_000_000,
  SOVEREIGN_RESERVE_SINGULARITY_USD: 2_000_000_000_000,
  BASEL_XIV_MIN_CET1_BPS: 4000, // 40.00%
  BASEL_XIV_MIN_LCR_BPS: 100000, // 1000.00%
  BASEL_XIV_MIN_NSFR_BPS: 40000, // 400.00%
  MIN_NETTING_COMPRESSION_RATIO_PCT: 99.998,
  MAX_SETTLEMENT_LATENCY_PICOSECONDS: 200, // target 150 ps (0.15 ns)
} as const;

export type PanGalacticCurrency =
  | 'USD'
  | 'EUR'
  | 'SGD'
  | 'JPY'
  | 'GBP'
  | 'sSDR_V6'
  | 'USDT'
  | 'MULTIVERSE_CREDIT'
  | 'ZERO_POINT_ENERGY';

export type PanGalacticPriorityTier =
  | 'PAN_GALACTIC_EXPEDITE'
  | 'MULTIVERSE_INSTITUTIONAL'
  | 'STANDARD_MULTIVERSE';

export type PanGalacticSettlementStatus =
  | 'QUEUED'
  | 'EARMARKED_RESERVE'
  | 'FINALIZED_IRREVOCABLE'
  | 'REJECTED_LIQUIDITY';

export interface PanGalacticHyperRtgsSession {
  id?: string;
  sessionRef: string;
  sourceParticipantId: string;
  targetParticipantId: string;
  assetCurrency: PanGalacticCurrency;
  grossAmountCents: number;
  priorityTier: PanGalacticPriorityTier;
  settlementStatus: PanGalacticSettlementStatus;
  executionLatencyPicoseconds: number;
  clearingReceiptHash: string;
  settledAt?: string;
  createdAt?: string;
}

export interface PanGalacticNettingObligation {
  fromParticipantId: string;
  toParticipantId: string;
  currency: PanGalacticCurrency;
  amountCents: number;
  subShardId?: string;
}

export type PanGalacticNettingStatus =
  | 'ACCUMULATING'
  | 'MULTIVERSE_SOLVED'
  | 'NET_EXECUTED'
  | 'NET_ABORTED';

export interface PanGalacticNettingBatch {
  id?: string;
  batchRef: string;
  hyperShardCount: number;
  grossFlowCount: number;
  grossVolumeCents: number;
  netSettlementVolumeCents: number;
  compressionRatioPct: number;
  nettingStatus: PanGalacticNettingStatus;
  multiverseSolutionHash: string;
  executedAt?: string;
  createdAt?: string;
}
