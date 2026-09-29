/**
 * @file inter-galactic-hyper-rtgs-capital.ts
 * @layer seed/types
 * @description Seed types and constants for Gate 28: Inter-Galactic Hyper-RTGS, $50.0T Sovereign Reserve Singularity & Basel XVIII Solvency.
 */

export const GATE_28_SCALE_TARGETS = {
  MRR_TARGET_USD: 5_000_000_000_000, // $5.0 Trillion MRR
  ARR_TARGET_USD: 60_000_000_000_000, // $60.0 Trillion ARR
  ACTIVE_PAID_CUSTOMERS: 20_000_000_000, // 20,000,000,000 (20 Billion customers)
  ARPU_USD: 250, // $250.00 / month
  NET_REVENUE_RETENTION_PERCENT: 225, // 225.0% NRR
  THIRTY_SIX_NINES_UPTIME_PERCENT: 99.9999999999999999999999999999999999,
  SOVEREIGN_BUFFER_TARGET_USD: 50_000_000_000_000,
  SOVEREIGN_RESERVE_SINGULARITY_USD: 50_000_000_000_000,
  BASEL_XVIII_MIN_CET1_BPS: 5500, // 55.00%
  BASEL_XVIII_MIN_LCR_BPS: 250000, // 2500.00%
  BASEL_XVIII_MIN_NSFR_BPS: 70000, // 700.00%
  MIN_NETTING_COMPRESSION_RATIO_PCT: 99.999999,
  MAX_SETTLEMENT_LATENCY_PICOSECONDS: 10, // target 5 ps (0.005 ns)
} as const;

export type InterGalacticCurrency =
  | 'USD'
  | 'EUR'
  | 'SGD'
  | 'JPY'
  | 'GBP'
  | 'sSDR_V10'
  | 'USDT'
  | 'INTER_GALACTIC_CREDIT'
  | 'ZERO_POINT_ENERGY'
  | 'SUB_PLANCK_FOAM_CREDIT';

export type InterGalacticPriorityTier =
  | 'INTER_GALACTIC_SINGULARITY'
  | 'INTER_GALACTIC_EXPEDITE'
  | 'MULTIVERSE_INSTITUTIONAL'
  | 'STANDARD_MULTIVERSE';

export type InterGalacticSettlementStatus =
  | 'QUEUED'
  | 'EARMARKED_RESERVE'
  | 'FINALIZED_IRREVOCABLE'
  | 'REJECTED_LIQUIDITY';

export interface InterGalacticRtgsPaymentSession {
  id?: string;
  sessionRef: string;
  sourceParticipantId: string;
  targetParticipantId: string;
  assetCurrency: InterGalacticCurrency;
  grossAmountCents: number;
  priorityTier: InterGalacticPriorityTier;
  settlementStatus: InterGalacticSettlementStatus;
  executionLatencyPicoseconds: number;
  clearingReceiptHash: string;
  settledAt?: string;
  createdAt?: string;
}

export interface InterGalacticNettingObligation {
  fromParticipantId: string;
  toParticipantId: string;
  currency: InterGalacticCurrency;
  amountCents: number;
  subShardId?: string;
}

export interface InterGalacticNettingBatch {
  id?: string;
  batchRef: string;
  hyperShardCount: number; // 2,097,152
  grossFlowCount: number;
  grossVolumeCents: number;
  netSettlementVolumeCents: number;
  compressionRatioPct: number;
  nettingStatus: 'PENDING' | 'COMPRESSING' | 'NET_EXECUTED' | 'FAILED';
  multiverseSolutionHash: string;
  executedAt?: string;
  createdAt?: string;
}

export type BaselXviiiSolvencyStatus =
  | 'SOLVENT_AND_CAPITALIZED'
  | 'CAPITAL_BUFFER_BREACH'
  | 'LIQUIDITY_RUN_DEFICIT'
  | 'SUPERVISORY_INTERVENTION';

export interface BaselXviiiSolvencyAudit {
  id?: string;
  auditRef: string;
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number; // >= 36,500 days (100 years)
  cet1RatioBps: number;
  lcrBps: number;
  nsfrBps: number;
  solvencyStatus: BaselXviiiSolvencyStatus;
  supervisorySignature: string;
  auditedAt: string;
  createdAt?: string;
}

export type InterGalacticCollateralAsset =
  | 'SOVEREIGN_BONDS'
  | 'PHYSICAL_GOLD'
  | 'SSDR_V10_BASKET'
  | 'TIER_1_EQUITIES'
  | 'MULTIVERSE_CREDITS'
  | 'INTER_GALACTIC_SUB_PLANCK_FOAM';

export type InterGalacticVaultSector =
  | 'INTER_GALACTIC_CORE'
  | 'OMNI_COSMIC_HUB'
  | 'TRANS_GALACTIC_VAULT'
  | 'VIRGO_SUPERCLUSTER_APEX'
  | 'SUB_PLANCK_FOAM_VAULT'
  | 'ZERO_POINT_CONTINUUM_HUB'
  | 'ETERNAL_SOVEREIGN_GATEWAY';

export interface InterGalacticCollateralReserve {
  id?: string;
  reserveRef: string;
  assetType: InterGalacticCollateralAsset;
  pledgedAmountCents: number;
  haircutFactor: number;
  netValuationCents: number;
  vaultSector: InterGalacticVaultSector;
  custodianSignature: string;
  createdAt?: string;
}
