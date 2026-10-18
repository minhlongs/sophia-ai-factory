/**
 * @file basel-viii-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel VIII Extreme Solvency & $25.0B Sovereign Planetary Capital Buffer.
 */

import { calculateParameterizedCollateralValue } from './basel-solvency-domain-engine';
import { evaluateTieredBaselSolvency } from './basel-tiered-solvency-evaluator';
import {
  GATE_18_SCALE_TARGETS,
  type BaselViiiSolvencyStatus,
  type GalacticCollateralAsset,
} from '@/seed/types/galactic-rtgs-capital';

export interface BaselViiiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselViiiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselViiiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const GALACTIC_COLLATERAL_HAIRCUTS: Record<GalacticCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.06,
  SSDR_BASKET: 1.12,
  TIER_1_EQUITIES: 1.25,
  GSC_CREDITS: 1.35,
  K3_ENERGY_CRYSTALS: 1.45,
};

/**
 * Calculates net haircut-adjusted collateral valuation for galactic multi-asset reserves.
 */
export function calculateGalacticCollateralValue(
  pledgedAmountCents: number,
  assetType: GalacticCollateralAsset,
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    GALACTIC_COLLATERAL_HAIRCUTS,
    1.5,
  );
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel VIII standards.
 */
export function evaluateBaselViiiSolvency(
  input: BaselViiiSolvencyInput,
): BaselViiiSolvencyOutput {
  return evaluateTieredBaselSolvency(input, {
    standardLabel: 'Basel VIII',
    signaturePrefix: 'BASEL_VIII',
    minCet1Bps: GATE_18_SCALE_TARGETS.BASEL_VIII_MIN_CET1_BPS,
    cet1Label: '25.00%',
    minLcrBps: GATE_18_SCALE_TARGETS.BASEL_VIII_MIN_LCR_BPS,
    lcrLabel: '400.00%',
    minNsfrBps: GATE_18_SCALE_TARGETS.BASEL_VIII_MIN_NSFR_BPS,
    nsfrLabel: '180.00%',
    targetBufferCents: GATE_18_SCALE_TARGETS.SOVEREIGN_BUFFER_TARGET_USD * 100,
    bufferLabel: '$25.0B',
    minSurvivalDays: 365,
    survivalLabel: '365-day',
  });
}
