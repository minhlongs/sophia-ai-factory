/**
 * @file basel-xl-solvency-types.ts
 * @layer tree/reserve
 * @description Types and collateral valuation logic for Basel XL Centum-Quintillion Solvency.
 */

import {
  calculateParameterizedCollateralValue,
} from './basel-solvency-domain-engine';
import type {
  BaselXlSolvencyStatus,
  CentumquintillionCollateralAssetType,
} from '@/seed/types/centumquintillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXlSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXlSolvencyOutput {
  isSolvent: boolean;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  solvencyStatus: BaselXlSolvencyStatus;
  supervisorySignature: string;
  violations: string[];
}

export interface CentumquintillionCollateralValuationResult {
  assetType: CentumquintillionCollateralAssetType;
  nominalValueCents: number;
  haircutMultiplier: number;
  netValuationCents: number;
}

/**
 * Haircut table for Centum-Quintillion high-tier sovereign collateral assets under Basel XL.
 */
export const CENTUMQUINTILLION_COLLATERAL_HAIRCUTS: Record<CentumquintillionCollateralAssetType, number> = {
  SOVEREIGN_BONDS: 1.0,
  PHYSICAL_GOLD: 1.005,
  SSDR_V30_BASKET: 1.010,
  TIER_1_EQUITIES: 1.020,
  CENTUMQUINTILLION_CREDITS: 1.025,
  CENTUMQUINTILLION_SUB_PLANCK_FOAM: 1.030,
};

/**
 * Calculates net haircut-adjusted collateral value.
 */
export function calculateCentumquintillionCollateralValue(
  nominalValueCents: number,
  assetType: CentumquintillionCollateralAssetType
): CentumquintillionCollateralValuationResult {
  return calculateParameterizedCollateralValue(
    nominalValueCents,
    assetType,
    CENTUMQUINTILLION_COLLATERAL_HAIRCUTS,
    1.05
  ) as unknown as CentumquintillionCollateralValuationResult;
}
