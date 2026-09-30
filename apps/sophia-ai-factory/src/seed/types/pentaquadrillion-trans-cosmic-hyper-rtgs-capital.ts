/**
 * @file pentaquadrillion-trans-cosmic-hyper-rtgs-capital.ts
 * @layer seed/types
 * @description Seed types and constants for Gate 34: Penta-Quadrillion Hyper-RTGS, $5.0Q Sovereign Reserve Singularity & Basel XXIV Solvency.
 */

export const GATE_34_SCALE_TARGETS = {
  MRR_TARGET_USD: 500_000_000_000_000, // $500.0 Trillion MRR
  ARR_TARGET_USD: 6_000_000_000_000_000, // $6.0 Quadrillion ARR
  ACTIVE_PAID_CUSTOMERS: 2_000_000_000_000, // 2,000,000,000,000 (2.0 Trillion customers)
  ARPU_USD: 250, // $250.00 / month
  NET_REVENUE_RETENTION_PERCENT: 280, // 280.0% NRR
  FIFTY_FOUR_NINES_UPTIME_PERCENT: 99.999999999999999999999999999999999999999999999999999999,
  SOVEREIGN_BUFFER_TARGET_USD: 5_000_000_000_000_000, // $5.0 Quadrillion USD
  SOVEREIGN_RESERVE_SINGULARITY_USD: 5_000_000_000_000_000,
  BASEL_XXIV_MIN_CET1_BPS: 8500, // 85.00%
  BASEL_XXIV_MIN_LCR_BPS: 800000, // 8000.00%
  BASEL_XXIV_MIN_NSFR_BPS: 200000, // 2000.00%
  MIN_NETTING_COMPRESSION_RATIO_PCT: 99.999999999999,
  MAX_SETTLEMENT_LATENCY_PICOSECONDS: 0.01, // target 0.005 ps (0.000005 ns)
} as const;

export type PentaquadrillionCurrency =
  | 'USD'
  | 'EUR'
  | 'SGD'
  | 'JPY'
  | 'GBP'
  | 'sSDR_V16'
  | 'USDT'
  | 'PENTAQUADRILLION_TRANS_COSMIC_CREDIT'
  | 'ZERO_POINT_ENERGY'
  | 'PENTAQUADRILLION_FOAM_CREDIT';

export type PentaquadrillionPriorityTier =
  | 'PENTAQUADRILLION_SINGULARITY'
  | 'PENTAQUADRILLION_SOVEREIGN_EXPEDITE'
  | 'PENTAQUADRILLION_INSTITUTIONAL'
  | 'STANDARD_PENTAQUADRILLION';

export type PentaquadrillionSettlementStatus =
  | 'QUEUED'
  | 'EARMARKED_RESERVE'
  | 'FINALIZED_IRREVOCABLE'
  | 'REJECTED_LIQUIDITY';

export interface PentaquadrillionRtgsPaymentSession {
  id?: string;
  sessionRef: string;
  sourceParticipantId: string;
  targetParticipantId: string;
  assetCurrency: PentaquadrillionCurrency;
  grossAmountCents: number;
  priorityTier: PentaquadrillionPriorityTier;
  settlementStatus: PentaquadrillionSettlementStatus;
  executionLatencyPicoseconds: number;
  clearingReceiptHash: string;
  settledAt?: string;
  createdAt?: string;
}

export interface PentaquadrillionNettingObligation {
  fromParticipantId: string;
  toParticipantId: string;
  currency: PentaquadrillionCurrency;
  amountCents: number;
  subShardId?: string;
}

export interface PentaquadrillionNettingBatch {
  id?: string;
  batchRef: string;
  hyperShardCount: number; // 134,217,728 (2^27)
  grossFlowCount: number;
  grossVolumeCents: number;
  netSettlementVolumeCents: number;
  compressionRatioPct: number;
  nettingStatus: 'PENDING' | 'COMPRESSING' | 'NET_EXECUTED' | 'FAILED';
  multiverseSolutionHash: string;
  executedAt?: string;
  createdAt?: string;
}

export type BaselXxivSolvencyStatus =
  | 'SOLVENT_AND_CAPITALIZED'
  | 'CAPITAL_BUFFER_BREACH'
  | 'LIQUIDITY_RUN_DEFICIT'
  | 'SUPERVISORY_INTERVENTION';

export interface BaselXxivSolvencyAudit {
  id?: string;
  auditRef: string;
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number; // >= 1,000,000 days (2,740 years)
  cet1RatioBps: number;
  lcrBps: number;
  nsfrBps: number;
  solvencyStatus: BaselXxivSolvencyStatus;
  supervisorySignature: string;
  auditedAt: string;
  createdAt?: string;
}

export type PentaquadrillionCollateralAsset =
  | 'SOVEREIGN_BONDS'
  | 'PHYSICAL_GOLD'
  | 'SSDR_V16_BASKET'
  | 'TIER_1_EQUITIES'
  | 'PENTAQUADRILLION_CREDITS'
  | 'PENTAQUADRILLION_SUB_PLANCK_FOAM';

export type PentaquadrillionCollateralVaultSector =
  | 'PENTAQUADRILLION_SINGULARITY_CORE'
  | 'TRANS_COSMIC_APEX_VAULT'
  | 'OMNIVERSAL_SUPRACLUSTER_HUB'
  | 'SUB_PLANCK_QUANTUM_WELL'
  | 'ZERO_POINT_RESERVE_MATRIX'
  | 'ETERNAL_SOVEREIGN_SANCTUM';

export interface PentaquadrillionCollateralReserve {
  id?: string;
  collateralRef: string;
  assetType: PentaquadrillionCollateralAsset;
  nominalValueCents: number;
  haircutFactor: number;
  collateralizedValueCents: number;
  custodyMultiverseVault: PentaquadrillionCollateralVaultSector;
  isRingFenced: boolean;
  verifiedAt: string;
  createdAt?: string;
}
