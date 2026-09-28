/**
 * @file galactic-rtgs-capital.ts
 * @layer seed/types
 * @description Seed types & scale constants for Gate 18: $2,500,000,000 MRR ($30.0B ARR, 10,000,000 Paid Customers).
 * The Kardashev Type III Galactic Super-Cluster Federation: Galactic-RTGS Clearing, Fractal Netting & $25.0B Sovereign Mesh.
 */

export const GATE_18_SCALE_TARGETS = {
  MRR_TARGET_USD: 2_500_000_000,
  ARR_TARGET_USD: 30_000_000_000,
  ACTIVE_PAID_CUSTOMERS: 10_000_000,
  ARPU_USD: 250,
  NET_REVENUE_RETENTION_PERCENT: 175,
  THIRTEEN_NINES_UPTIME_PERCENT: 99.99999999999,
  SOVEREIGN_BUFFER_TARGET_USD: 25_000_000_000,
  SOVEREIGN_PLANETARY_CAPITAL_BUFFER_USD: 25_000_000_000,
  BASEL_VIII_MIN_CET1_BPS: 2500, // 25.00%
  BASEL_VIII_MIN_LCR_BPS: 40000, // 400.00%
  BASEL_VIII_MIN_NSFR_BPS: 18000, // 180.00%
  MIN_NETTING_COMPRESSION_RATIO_PCT: 99.0,
  MAX_SETTLEMENT_LATENCY_NANOS: 100,
} as const;

export type GalacticRtgsCurrency =
  | 'USD'
  | 'EUR'
  | 'SGD'
  | 'JPY'
  | 'GBP'
  | 'sSDR'
  | 'USDT'
  | 'GSC'
  | 'K3_ENERGY';

export type GalacticRtgsPriorityTier =
  | 'QUANTUM_EXPEDITE'
  | 'GALACTIC_INSTITUTIONAL'
  | 'STANDARD_FEDERATION';

export type GalacticRtgsSettlementStatus =
  | 'QUEUED'
  | 'EARMARKED_RESERVE'
  | 'FINALIZED_IRREVOCABLE'
  | 'REJECTED_INSUFFICIENT_LIQUIDITY';

export interface GalacticRtgsClearingSession {
  id?: string;
  sessionRef: string;
  sourceParticipantId: string;
  targetParticipantId: string;
  assetCurrency: GalacticRtgsCurrency;
  grossAmountCents: number;
  priorityTier: GalacticRtgsPriorityTier;
  settlementStatus: GalacticRtgsSettlementStatus;
  executionLatencyNanos: number;
  clearingReceiptHash: string;
  settledAt?: string;
  createdAt?: string;
}

export type FractalNettingStatus =
  | 'ACCUMULATING'
  | 'FRACTAL_SOLVED'
  | 'NET_EXECUTED'
  | 'NET_ABORTED';

export interface FractalNettingObligation {
  fromParticipantId: string;
  toParticipantId: string;
  currency: GalacticRtgsCurrency;
  amountCents: number;
}

export interface FractalMultilateralNettingBatch {
  id?: string;
  batchRef: string;
  hierarchicalShardCount: number;
  grossFlowCount: number;
  grossVolumeCents: number;
  netSettlementVolumeCents: number;
  compressionRatioPct: number;
  nettingStatus: FractalNettingStatus;
  fractalSolutionHash: string;
  executedAt?: string;
  createdAt?: string;
}

export type GalacticCollateralAsset =
  | 'SOVEREIGN_BONDS'
  | 'PHYSICAL_GOLD'
  | 'SSDR_BASKET'
  | 'TIER_1_EQUITIES'
  | 'GSC_CREDITS'
  | 'K3_ENERGY_CRYSTALS';

export type GalacticVaultHubId =
  | 'MILKY_WAY_PRIME'
  | 'ANDROMEDA_HUB'
  | 'TRIANGULUM_RELAY'
  | 'VIRGO_CLUSTER_CORE'
  | 'DEEP_GALACTIC_NODE';

export interface SovereignPlanetaryCapitalReserve {
  id?: string;
  vaultHubId: GalacticVaultHubId;
  assetType: GalacticCollateralAsset;
  pledgedAmountCents: number;
  haircutFactor: number;
  netCollateralValueCents: number;
  custodianAuthority: string;
  lastAuditedAt: string;
  createdAt?: string;
}

export type BaselViiiSolvencyStatus =
  | 'SOLVENT_AND_CAPITALIZED'
  | 'CAPITAL_BUFFER_BREACH'
  | 'LIQUIDITY_RUN_RISK'
  | 'REGULATORY_HALT';

export interface BaselViiiSolvencySnapshot {
  id?: string;
  snapshotRef: string;
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  cet1RatioBps: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30dCents: number;
  liquidityCoverageRatioBps: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  netStableFundingRatioBps: number;
  sovereignPlanetaryCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  isBaselViiiCompliant: boolean;
  solvencyStatus: BaselViiiSolvencyStatus;
  supervisorySignature: string;
  createdAt?: string;
}
