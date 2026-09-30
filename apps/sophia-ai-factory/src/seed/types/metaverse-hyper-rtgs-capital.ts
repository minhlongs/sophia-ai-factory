/**
 * @file metaverse-hyper-rtgs-capital.ts
 * @layer seed/types
 * @description Seed types and constants for Gate 30: Omnipresent Metaverse Hyper-RTGS, $250.0T Sovereign Reserve Singularity & Basel XX Solvency.
 */

export const GATE_30_SCALE_TARGETS = {
  MRR_TARGET_USD: 25_000_000_000_000, // $25.0 Trillion MRR
  ARR_TARGET_USD: 300_000_000_000_000, // $300.0 Trillion ARR
  ACTIVE_PAID_CUSTOMERS: 100_000_000_000, // 100,000,000,000 (100 Billion customers)
  ARPU_USD: 250, // $250.00 / month
  NET_REVENUE_RETENTION_PERCENT: 240, // 240.0% NRR
  FORTY_TWO_NINES_UPTIME_PERCENT: 99.9999999999999999999999999999999999999999,
  SOVEREIGN_BUFFER_TARGET_USD: 250_000_000_000_000,
  SOVEREIGN_RESERVE_SINGULARITY_USD: 250_000_000_000_000,
  BASEL_XX_MIN_CET1_BPS: 6500, // 65.00%
  BASEL_XX_MIN_LCR_BPS: 350000, // 3500.00%
  BASEL_XX_MIN_NSFR_BPS: 90000, // 900.00%
  MIN_NETTING_COMPRESSION_RATIO_PCT: 99.99999999,
  MAX_SETTLEMENT_LATENCY_PICOSECONDS: 1, // target 0.5 ps (0.0005 ns)
} as const;

export type MetaverseCurrency =
  | 'USD'
  | 'EUR'
  | 'SGD'
  | 'JPY'
  | 'GBP'
  | 'sSDR_V12'
  | 'USDT'
  | 'METAVERSE_SOVEREIGN_CREDIT'
  | 'ZERO_POINT_ENERGY'
  | 'OMNIPRESENT_FOAM_CREDIT';

export type MetaversePriorityTier =
  | 'METAVERSE_SOVEREIGN_SINGULARITY'
  | 'METAVERSE_SOVEREIGN_EXPEDITE'
  | 'MULTIVERSE_INSTITUTIONAL'
  | 'STANDARD_MULTIVERSE';

export type MetaverseSettlementStatus =
  | 'QUEUED'
  | 'EARMARKED_RESERVE'
  | 'FINALIZED_IRREVOCABLE'
  | 'REJECTED_LIQUIDITY';

export interface MetaverseRtgsPaymentSession {
  id?: string;
  sessionRef: string;
  sourceParticipantId: string;
  targetParticipantId: string;
  assetCurrency: MetaverseCurrency;
  grossAmountCents: number;
  priorityTier: MetaversePriorityTier;
  settlementStatus: MetaverseSettlementStatus;
  executionLatencyPicoseconds: number;
  clearingReceiptHash: string;
  settledAt?: string;
  createdAt?: string;
}

export interface MetaverseNettingObligation {
  fromParticipantId: string;
  toParticipantId: string;
  currency: MetaverseCurrency;
  amountCents: number;
  subShardId?: string;
}

export interface MetaverseNettingBatch {
  id?: string;
  batchRef: string;
  hyperShardCount: number; // 8,388,608
  grossFlowCount: number;
  grossVolumeCents: number;
  netSettlementVolumeCents: number;
  compressionRatioPct: number;
  nettingStatus: 'PENDING' | 'COMPRESSING' | 'NET_EXECUTED' | 'FAILED';
  multiverseSolutionHash: string;
  executedAt?: string;
  createdAt?: string;
}

export type BaselXxSolvencyStatus =
  | 'SOLVENT_AND_CAPITALIZED'
  | 'CAPITAL_BUFFER_BREACH'
  | 'LIQUIDITY_RUN_DEFICIT'
  | 'SUPERVISORY_INTERVENTION';

export interface BaselXxSolvencyAudit {
  id?: string;
  auditRef: string;
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number; // >= 109,500 days (300 years)
  cet1RatioBps: number;
  lcrBps: number;
  nsfrBps: number;
  solvencyStatus: BaselXxSolvencyStatus;
  supervisorySignature: string;
  auditedAt: string;
  createdAt?: string;
}

export type MetaverseCollateralAsset =
  | 'SOVEREIGN_BONDS'
  | 'PHYSICAL_GOLD'
  | 'SSDR_V12_BASKET'
  | 'TIER_1_EQUITIES'
  | 'MULTIVERSE_CREDITS'
  | 'METAVERSE_SUB_PLANCK_FOAM';

export type MetaverseVaultSector =
  | 'METAVERSE_CORE_SINGULARITY'
  | 'OMNIPRESENT_APEX'
  | 'TRANS_COSMIC_VAULT'
  | 'VIRGO_SUPRACLUSTER_HUB'
  | 'SUB_PLANCK_FOAM_MATRIX'
  | 'ZERO_POINT_RESERVE_WELL'
  | 'ETERNAL_SOVEREIGN_GATEWAY';

export interface MetaverseCollateralReserve {
  id?: string;
  reserveRef: string;
  assetType: MetaverseCollateralAsset;
  pledgedAmountCents: number;
  haircutFactor: number;
  netValuationCents: number;
  vaultSector: MetaverseVaultSector;
  custodianSignature: string;
  createdAt?: string;
}
