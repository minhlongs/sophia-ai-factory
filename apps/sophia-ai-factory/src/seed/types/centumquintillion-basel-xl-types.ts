/**
 * @file centumquintillion-basel-xl-types.ts
 * @layer seed/types
 * @description Basel XL solvency audit and collateral reserve types for Gate 50.
 */

export const BASEL_XL_CONSTRAINTS = {
  MIN_CET1_RATIO_BPS: 9999, // 99.99%
  MIN_LIQUIDITY_COVERAGE_RATIO_BPS: 25_000_000, // 250,000.00%
  MIN_NET_STABLE_FUNDING_RATIO_BPS: 3_500_000, // 35,000.00%
  MIN_SURVIVAL_HORIZON_DAYS: 50_000_000, // 50,000,000 days (136,986 years)
  SOVEREIGN_CAPITAL_BUFFER_MIN_CENTS: 100_000_000_000_000_000_000_000, // $1,000,000.0Q in cents
} as const;

export type BaselXlSolvencyStatus =
  | 'SOLVENT_AND_CAPITALIZED'
  | 'LIQUIDITY_RESTRICTED'
  | 'CAPITAL_BUFFER_BREACH'
  | 'INSOLVENT_HALT';

export interface BaselXlSolvencyAudit {
  id?: string;
  auditRef: string;
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  cet1RatioBps: number;
  lcrBps: number;
  nsfrBps: number;
  solvencyStatus: BaselXlSolvencyStatus;
  supervisorySignature: string;
  auditedAt: string;
  createdAt?: string;
}

export type CentumquintillionCollateralAssetType =
  | 'SOVEREIGN_BONDS'
  | 'PHYSICAL_GOLD'
  | 'SSDR_V30_BASKET'
  | 'TIER_1_EQUITIES'
  | 'CENTUMQUINTILLION_CREDITS'
  | 'CENTUMQUINTILLION_SUB_PLANCK_FOAM';

export type CentumquintillionCollateralVaultSector =
  | 'CENTUMQUINTILLION_SINGULARITY_CORE'
  | 'TRANS_COSMIC_APEX_VAULT'
  | 'OMNIVERSAL_SUPRACLUSTER_HUB'
  | 'SUB_PLANCK_QUANTUM_WELL'
  | 'ZERO_POINT_RESERVE_MATRIX'
  | 'ETERNAL_SOVEREIGN_SANCTUM';

export interface CentumquintillionCollateralReserve {
  id?: string;
  collateralRef: string;
  assetType: CentumquintillionCollateralAssetType;
  nominalValueCents: number;
  haircutFactor: number;
  collateralizedValueCents: number;
  custodyMultiverseVault: CentumquintillionCollateralVaultSector;
  isRingFenced: boolean;
  verifiedAt: string;
  createdAt?: string;
}
