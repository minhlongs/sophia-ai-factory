/**
 * @file omniversal-clearing.ts
 * @layer seed/types
 * @description Seed types & scale constants for Gate 15: $250,000,000 MRR ($3.0B ARR, 1,000,000 Paid Customers)
 * Trans-Galactic Omniverse Economy: RTGS Clearing House, Multilateral Netting & $2.5B Sovereign Liquidity Mesh.
 */

export const GATE_15_SCALE_TARGETS = {
  MRR_TARGET_USD: 250_000_000,
  ARR_TARGET_USD: 3_000_000_000,
  ACTIVE_PAID_CUSTOMERS: 1_000_000,
  ARPU_USD: 250,
  NET_REVENUE_RETENTION_PERCENT: 165,
  TEN_NINES_UPTIME_PERCENT: 99.99999999,
  SOVEREIGN_BUFFER_TARGET_USD: 2_500_000_000,
  BASEL_V_MIN_CET1_BPS: 1800, // 18.00%
  BASEL_V_MIN_LCR_BPS: 25000, // 250.00%
  BASEL_V_MIN_NSFR_BPS: 13500, // 135.00%
  MIN_NETTING_COMPRESSION_RATIO_PCT: 90.0,
} as const;

export type OmniversalCurrency = 'USD' | 'EUR' | 'SGD' | 'JPY' | 'GBP' | 'SSDR' | 'GEAC';

export type RtgsPriorityTier = 'CRITICAL_SYSTEMIC' | 'HIGH_INSTITUTIONAL' | 'STANDARD_COMMERCIAL';

export type RtgsSettlementStatus =
  | 'QUEUED'
  | 'EARMARKED_RESERVE'
  | 'FINALIZED_IRREVOCABLE'
  | 'REJECTED_INSUFFICIENT_LIQUIDITY';

export interface RtgsClearingSession {
  id: string;
  sessionRef: string;
  sourceParticipantId: string;
  targetParticipantId: string;
  assetCurrency: OmniversalCurrency;
  grossAmountCents: number;
  priorityTier: RtgsPriorityTier;
  settlementStatus: RtgsSettlementStatus;
  executionLatencyMicros: number;
  clearingReceiptHash: string;
  settledAt?: string;
  createdAt: string;
}

export type NettingStatus = 'ACCUMULATING' | 'GRAPH_SOLVED' | 'NET_EXECUTED' | 'NET_ABORTED';

export interface NettingObligation {
  fromParticipantId: string;
  toParticipantId: string;
  currency: OmniversalCurrency;
  amountCents: number;
}

export interface MultilateralNettingBatch {
  id: string;
  batchRef: string;
  cycleIntervalSeconds: number;
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

export interface BaselVSolvencySnapshot {
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

export type SovereignVaultLocation =
  | 'FED_NEW_YORK'
  | 'ECB_FRANKFURT'
  | 'MAS_SINGAPORE'
  | 'SNB_ZURICH'
  | 'ORBITAL_LAGRANGE_VAULT';

export type OmniversalCollateralAsset =
  | 'SOVEREIGN_BONDS'
  | 'PHYSICAL_GOLD'
  | 'SSDR_BASKET'
  | 'TIER_1_EQUITIES'
  | 'GEAC_COMPUTE_CREDITS';

export interface SovereignOmniversalReserve {
  id: string;
  vaultCode: string;
  vaultLocation: SovereignVaultLocation;
  allocatedCapitalCents: number;
  haircutAdjustedValuationCents: number;
  primaryAssetType: OmniversalCollateralAsset;
  lastRebalancedAt: string;
  createdAt: string;
}
