/**
 * @file super-rtgs-capital.ts
 * @layer seed/types
 * @description Seed types & scale constants for Gate 16: $500,000,000 MRR ($6.0B ARR, 2,000,000 Paid Customers)
 * Kardashev Type II Stellar Civilization: Super-RTGS Clearing, Parallel Netting & $5.0B Universal Capital Mesh.
 */

export const GATE_16_SCALE_TARGETS = {
  MRR_TARGET_USD: 500_000_000,
  ARR_TARGET_USD: 6_000_000_000,
  ACTIVE_PAID_CUSTOMERS: 2_000_000,
  ARPU_USD: 250,
  NET_REVENUE_RETENTION_PERCENT: 170,
  ELEVEN_NINES_UPTIME_PERCENT: 99.999999999,
  SOVEREIGN_BUFFER_TARGET_USD: 5_000_000_000,
  UNIVERSAL_CAPITAL_BUFFER_USD: 5_000_000_000,
  BASEL_VI_MIN_CET1_BPS: 2000, // 20.00%
  BASEL_VI_MIN_LCR_BPS: 30000, // 300.00%
  BASEL_VI_MIN_NSFR_BPS: 15000, // 150.00%
  MIN_NETTING_COMPRESSION_RATIO_PCT: 95.0,
} as const;

export type SuperRtgsCurrency = 'USD' | 'EUR' | 'SGD' | 'JPY' | 'GBP' | 'SSDR' | 'KSCE';

export type SuperRtgsPriorityTier =
  | 'CRITICAL_STELLAR'
  | 'HIGH_INSTITUTIONAL'
  | 'STANDARD_COMMERCIAL';

export type SuperRtgsSettlementStatus =
  | 'QUEUED'
  | 'EARMARKED_RESERVE'
  | 'FINALIZED_IRREVOCABLE'
  | 'REJECTED_INSUFFICIENT_LIQUIDITY';

export interface SuperRtgsClearingSession {
  id: string;
  sessionRef: string;
  sourceParticipantId: string;
  targetParticipantId: string;
  assetCurrency: SuperRtgsCurrency;
  grossAmountCents: number;
  priorityTier: SuperRtgsPriorityTier;
  settlementStatus: SuperRtgsSettlementStatus;
  executionLatencyNanos: number;
  clearingReceiptHash: string;
  settledAt?: string;
  createdAt: string;
}

export type NettingStatus = 'ACCUMULATING' | 'GRAPH_SOLVED' | 'NET_EXECUTED' | 'NET_ABORTED';

export interface ParallelNettingObligation {
  fromParticipantId: string;
  toParticipantId: string;
  currency: SuperRtgsCurrency;
  amountCents: number;
}

export interface ParallelMultilateralNettingBatch {
  id: string;
  batchRef: string;
  parallelPartitionCount: number;
  grossFlowCount: number;
  grossVolumeCents: number;
  netSettlementVolumeCents: number;
  compressionRatioPct: number;
  participantCount: number;
  nettingStatus: NettingStatus;
  graphSolutionHash: string;
  executedAt?: string;
  createdAt: string;
}

export interface BaselViSolvencySnapshot {
  id: string;
  auditCycle: string;
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
  isSolvent: boolean;
  supervisorySignature: string;
  createdAt: string;
}

export type UniversalVaultLocation =
  | 'FED_NEW_YORK'
  | 'ECB_FRANKFURT'
  | 'MAS_SINGAPORE'
  | 'SNB_ZURICH'
  | 'BOJ_TOKYO'
  | 'ORBITAL_LAGRANGE_SUPERVAULT';

export type UniversalCollateralAsset =
  | 'SOVEREIGN_BONDS'
  | 'PHYSICAL_GOLD'
  | 'SSDR_BASKET'
  | 'TIER_1_EQUITIES'
  | 'KSCE_STELLAR_CREDITS';

export interface UniversalCapitalReserve {
  id: string;
  vaultCode: string;
  vaultLocation: UniversalVaultLocation;
  allocatedCapitalCents: number;
  haircutAdjustedValuationCents: number;
  primaryAssetType: UniversalCollateralAsset;
  lastRebalancedAt: string;
  createdAt: string;
}
