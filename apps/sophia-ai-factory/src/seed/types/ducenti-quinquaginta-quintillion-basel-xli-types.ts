/**
 * @file ducenti-quinquaginta-quintillion-basel-xli-types.ts
 * @layer seed/types
 * @description Basel XLI solvency audit and collateral reserve types for Gate 51.
 */

export const BASEL_XLI_CONSTRAINTS = {
  MIN_CET1_RATIO_BPS: 9999, // 99.99%
  MIN_LIQUIDITY_COVERAGE_RATIO_BPS: 30_000_000, // 300,000.00%
  MIN_NET_STABLE_FUNDING_RATIO_BPS: 4_000_000, // 40,000.00%
  MIN_SURVIVAL_HORIZON_DAYS: 100_000_000, // 100,000,000 days (273,972 years)
  SOVEREIGN_CAPITAL_BUFFER_MIN_CENTS: 250_000_000_000_000_000_000_000, // $2,500,000.0Q in cents
} as const;

export type BaselXliSolvencyStatus =
  | 'SOLVENT_AND_CAPITALIZED'
  | 'LIQUIDITY_RESTRICTED'
  | 'CAPITAL_BUFFER_BREACH'
  | 'INSOLVENT_HALT';

export interface BaselXliSolvencyAudit {
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
  solvencyStatus: BaselXliSolvencyStatus;
  supervisorySignature: string;
  auditedAt: string;
  createdAt?: string;
}

export type DucentiquinquagintaquintillionCollateralAssetType =
  | 'SOVEREIGN_BONDS'
  | 'PHYSICAL_GOLD'
  | 'SSDR_V30_BASKET'
  | 'TIER_1_EQUITIES'
  | 'DUCENTIQUINQUAGINTAQUINTILLION_CREDITS'
  | 'DUCENTIQUINQUAGINTAQUINTILLION_SUB_PLANCK_FOAM';

export type DucentiquinquagintaquintillionCollateralVaultSector =
  | 'DUCENTIQUINQUAGINTAQUINTILLION_SINGULARITY_CORE'
  | 'TRANS_COSMIC_APEX_VAULT'
  | 'OMNIVERSAL_SUPRACLUSTER_HUB'
  | 'SUB_PLANCK_QUANTUM_WELL'
  | 'ZERO_POINT_RESERVE_MATRIX'
  | 'ETERNAL_SOVEREIGN_SANCTUM';

export interface DucentiquinquagintaquintillionCollateralReserve {
  id?: string;
  collateralRef: string;
  assetType: DucentiquinquagintaquintillionCollateralAssetType;
  nominalValueCents: number;
  haircutFactor: number;
  collateralizedValueCents: number;
  custodyMultiverseVault: DucentiquinquagintaquintillionCollateralVaultSector;
  isRingFenced: boolean;
  verifiedAt: string;
  createdAt?: string;
}
