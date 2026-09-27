/**
 * @file hyper-rtgs-capital.ts
 * @layer seed/types
 * @description Seed types & scale constants for Gate 17: $1,000,000,000 MRR ($12.0B ARR, 4,000,000 Paid Customers).
 * The Deca-Unicorn Sovereign Interstellar Civilization: Hyper-RTGS Clearing, Distributed Netting & $10.0B Capital Mesh.
 */

export const GATE_17_SCALE_TARGETS = {
  MRR_TARGET_USD: 1_000_000_000,
  ARR_TARGET_USD: 12_000_000_000,
  ACTIVE_PAID_CUSTOMERS: 4_000_000,
  ARPU_USD: 250,
  NET_REVENUE_RETENTION_PERCENT: 175,
  TWELVE_NINES_UPTIME_PERCENT: 99.9999999999,
  SOVEREIGN_BUFFER_TARGET_USD: 10_000_000_000,
  INTERSTELLAR_CAPITAL_BUFFER_USD: 10_000_000_000,
  BASEL_VII_MIN_CET1_BPS: 2200, // 22.00%
  BASEL_VII_MIN_LCR_BPS: 35000, // 350.00%
  BASEL_VII_MIN_NSFR_BPS: 16000, // 160.00%
  MIN_NETTING_COMPRESSION_RATIO_PCT: 98.0,
} as const;

export type HyperRtgsCurrency =
  | 'USD'
  | 'EUR'
  | 'SGD'
  | 'JPY'
  | 'GBP'
  | 'SSDR'
  | 'USDT'
  | 'KSCE'
  | 'ISCE';

export type HyperRtgsPriorityTier =
  | 'WARP_EXPEDITE'
  | 'INTERSTELLAR_INSTITUTIONAL'
  | 'STANDARD_SYSTEM';

export type HyperRtgsSettlementStatus =
  | 'QUEUED'
  | 'EARMARKED_RESERVE'
  | 'FINALIZED_IRREVOCABLE'
  | 'REJECTED_INSUFFICIENT_LIQUIDITY';

export interface HyperRtgsClearingSession {
  id?: string;
  sessionRef: string;
  sourceParticipantId: string;
  targetParticipantId: string;
  assetCurrency: HyperRtgsCurrency;
  grossAmountCents: number;
  priorityTier: HyperRtgsPriorityTier;
  settlementStatus: HyperRtgsSettlementStatus;
  executionLatencyNanos: number;
  clearingReceiptHash: string;
  settledAt?: string;
  createdAt?: string;
}

export type DistributedNettingStatus =
  | 'ACCUMULATING'
  | 'GRAPH_SOLVED'
  | 'NET_EXECUTED'
  | 'NET_ABORTED';

export interface DistributedNettingObligation {
  fromParticipantId: string;
  toParticipantId: string;
  currency: HyperRtgsCurrency;
  amountCents: number;
}

export interface DistributedMultilateralNettingBatch {
  id?: string;
  batchRef: string;
  networkPartitionCount: number;
  grossFlowCount: number;
  grossVolumeCents: number;
  netSettlementVolumeCents: number;
  compressionRatioPct: number;
  nettingStatus: DistributedNettingStatus;
  graphSolutionHash: string;
  executedAt?: string;
  createdAt?: string;
}

export type InterstellarCollateralAsset =
  | 'SOVEREIGN_BONDS'
  | 'PHYSICAL_GOLD'
  | 'SSDR_BASKET'
  | 'TIER_1_EQUITIES'
  | 'KSCE_CREDITS'
  | 'ISCE_TACHYON';

export type InterstellarVaultHubId =
  | 'SOL_EARTH_CENTRAL'
  | 'ALPHA_CENTAURI_RELAY'
  | 'LUNAR_LAGRANGE_VAULT'
  | 'MARS_OASIS_VAULT'
  | 'DEEP_SPACE_NODE';

export interface InterstellarCapitalReserve {
  id?: string;
  vaultHubId: InterstellarVaultHubId;
  assetType: InterstellarCollateralAsset;
  pledgedAmountCents: number;
  haircutFactor: number;
  netCollateralValueCents: number;
  custodianAuthority: string;
  lastAuditedAt: string;
  createdAt?: string;
}

export type BaselViiSolvencyStatus =
  | 'SOLVENT_AND_CAPITALIZED'
  | 'CAPITAL_BUFFER_BREACH'
  | 'LIQUIDITY_RUN_RISK'
  | 'REGULATORY_HALT';

export interface BaselViiSolvencySnapshot {
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
  interstellarCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  isBaselViiCompliant: boolean;
  solvencyStatus: BaselViiSolvencyStatus;
  supervisorySignature: string;
  createdAt?: string;
}
