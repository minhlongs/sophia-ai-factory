/**
 * @file basel-ix-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel IX Trans-Universal Solvency & $50.0B Multi-Dimensional Capital Buffer.
 */

import { calculateParameterizedCollateralValue } from './basel-solvency-domain-engine';
import { evaluateTieredBaselSolvency } from './basel-tiered-solvency-evaluator';
import {
  GATE_19_SCALE_TARGETS,
  type BaselIxSolvencyStatus,
  type MultidimensionalCollateralAsset,
} from '@/seed/types/omniverse-rtgs-capital';

export interface BaselIxSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselIxSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselIxSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const MULTIDIMENSIONAL_COLLATERAL_HAIRCUTS: Record<MultidimensionalCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.05,
  SSDR_BASKET: 1.10,
  TIER_1_EQUITIES: 1.20,
  OMNI_CREDITS: 1.30,
  PLANCK_ENERGY_SINGULARITIES: 1.40,
};

/**
 * Calculates net haircut-adjusted collateral valuation for multi-dimensional sovereign reserves.
 */
export function calculateMultidimensionalCollateralValue(
  pledgedAmountCents: number,
  assetType: MultidimensionalCollateralAsset,
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    MULTIDIMENSIONAL_COLLATERAL_HAIRCUTS,
    1.5,
  );
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel IX standards.
 */
export function evaluateBaselIxSolvency(
  input: BaselIxSolvencyInput,
): BaselIxSolvencyOutput {
  return evaluateTieredBaselSolvency(input, {
    standardLabel: 'Basel IX',
    signaturePrefix: 'BASEL_IX',
    minCet1Bps: GATE_19_SCALE_TARGETS.BASEL_IX_MIN_CET1_BPS,
    cet1Label: '28.00%',
    minLcrBps: GATE_19_SCALE_TARGETS.BASEL_IX_MIN_LCR_BPS,
    lcrLabel: '500.00%',
    minNsfrBps: GATE_19_SCALE_TARGETS.BASEL_IX_MIN_NSFR_BPS,
    nsfrLabel: '200.00%',
    targetBufferCents: GATE_19_SCALE_TARGETS.SOVEREIGN_BUFFER_TARGET_USD * 100,
    bufferLabel: '$50.0B',
    minSurvivalDays: 730,
    survivalLabel: '730-day (2-year)',
  });
}
