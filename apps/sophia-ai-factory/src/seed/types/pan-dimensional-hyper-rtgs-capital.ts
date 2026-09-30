/**
 * @file pan-dimensional-hyper-rtgs-capital.ts
 * @layer seed/types
 * @description Seed types and constants for Gate 29: Pan-Dimensional Hyper-RTGS, $100.0T Sovereign Reserve Singularity & Basel XIX Solvency.
 */

export const GATE_29_SCALE_TARGETS = {
  MRR_TARGET_USD: 10_000_000_000_000, // $10.0 Trillion MRR
  ARR_TARGET_USD: 120_000_000_000_000, // $120.0 Trillion ARR
  ACTIVE_PAID_CUSTOMERS: 40_000_000_000, // 40,000,000,000 (40 Billion customers)
  ARPU_USD: 250, // $250.00 / month
  NET_REVENUE_RETENTION_PERCENT: 230, // 230.0% NRR
  THIRTY_NINE_NINES_UPTIME_PERCENT: 99.9999999999999999999999999999999999999,
  SOVEREIGN_BUFFER_TARGET_USD: 100_000_000_000_000,
  SOVEREIGN_RESERVE_SINGULARITY_USD: 100_000_000_000_000,
  BASEL_XIX_MIN_CET1_BPS: 6000, // 60.00%
  BASEL_XIX_MIN_LCR_BPS: 300000, // 3000.00%
  BASEL_XIX_MIN_NSFR_BPS: 80000, // 800.00%
  MIN_NETTING_COMPRESSION_RATIO_PCT: 99.9999999,
  MAX_SETTLEMENT_LATENCY_PICOSECONDS: 5, // target 2 ps (0.002 ns)
} as const;

export type PanDimensionalCurrency =
  | 'USD'
  | 'EUR'
  | 'SGD'
  | 'JPY'
  | 'GBP'
  | 'sSDR_V11'
  | 'USDT'
  | 'PAN_DIMENSIONAL_CREDIT'
  | 'ZERO_POINT_ENERGY'
  | 'TRANS_COSMIC_FOAM_CREDIT';

export type PanDimensionalPriorityTier =
  | 'PAN_DIMENSIONAL_SINGULARITY'
  | 'PAN_DIMENSIONAL_EXPEDITE'
  | 'MULTIVERSE_INSTITUTIONAL'
  | 'STANDARD_MULTIVERSE';

export type PanDimensionalSettlementStatus =
  | 'QUEUED'
  | 'EARMARKED_RESERVE'
  | 'FINALIZED_IRREVOCABLE'
  | 'REJECTED_LIQUIDITY';

export interface PanDimensionalRtgsPaymentSession {
  id?: string;
  sessionRef: string;
  sourceParticipantId: string;
  targetParticipantId: string;
  assetCurrency: PanDimensionalCurrency;
  grossAmountCents: number;
  priorityTier: PanDimensionalPriorityTier;
  settlementStatus: PanDimensionalSettlementStatus;
  executionLatencyPicoseconds: number;
  clearingReceiptHash: string;
  settledAt?: string;
  createdAt?: string;
}

export interface PanDimensionalNettingObligation {
  fromParticipantId: string;
  toParticipantId: string;
  currency: PanDimensionalCurrency;
  amountCents: number;
  subShardId?: string;
}

export interface PanDimensionalNettingBatch {
  id?: string;
  batchRef: string;
  hyperShardCount: number; // 4,194,304
  grossFlowCount: number;
  grossVolumeCents: number;
  netSettlementVolumeCents: number;
  compressionRatioPct: number;
  nettingStatus: 'PENDING' | 'COMPRESSING' | 'NET_EXECUTED' | 'FAILED';
  multiverseSolutionHash: string;
  executedAt?: string;
  createdAt?: string;
}

export type BaselXixSolvencyStatus =
  | 'SOLVENT_AND_CAPITALIZED'
  | 'CAPITAL_BUFFER_BREACH'
  | 'LIQUIDITY_RUN_DEFICIT'
  | 'SUPERVISORY_INTERVENTION';

export interface BaselXixSolvencyAudit {
  id?: string;
  auditRef: string;
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number; // >= 73,000 days (200 years)
  cet1RatioBps: number;
  lcrBps: number;
  nsfrBps: number;
  solvencyStatus: BaselXixSolvencyStatus;
  supervisorySignature: string;
  auditedAt: string;
  createdAt?: string;
}

export type PanDimensionalCollateralAsset =
  | 'SOVEREIGN_BONDS'
  | 'PHYSICAL_GOLD'
  | 'SSDR_V11_BASKET'
  | 'TIER_1_EQUITIES'
  | 'MULTIVERSE_CREDITS'
  | 'PAN_DIMENSIONAL_SUB_PLANCK_FOAM';

export type PanDimensionalVaultSector =
  | 'PAN_DIMENSIONAL_CORE'
  | 'OMNI_COSMIC_APEX'
  | 'TRANS_COSMIC_VAULT'
  | 'VIRGO_SUPRACLUSTER_HUB'
  | 'SUB_PLANCK_FOAM_MATRIX'
  | 'ZERO_POINT_RESERVE_WELL'
  | 'ETERNAL_SOVEREIGN_GATEWAY';

export interface PanDimensionalCollateralReserve {
  id?: string;
  reserveRef: string;
  assetType: PanDimensionalCollateralAsset;
  pledgedAmountCents: number;
  haircutFactor: number;
  netValuationCents: number;
  vaultSector: PanDimensionalVaultSector;
  custodianSignature: string;
  createdAt?: string;
}
