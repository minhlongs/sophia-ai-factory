/**
 * @file basel-vii-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel VII Extreme Solvency & $10.0B Interstellar Capital Buffer.
 */

import { calculateParameterizedCollateralValue } from './basel-solvency-domain-engine';
import { evaluateTieredBaselSolvency } from './basel-tiered-solvency-evaluator';
import {
  GATE_17_SCALE_TARGETS,
  type BaselViiSolvencyStatus,
  type InterstellarCollateralAsset,
} from '@/seed/types/hyper-rtgs-capital';

export interface BaselViiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselViiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselViiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const INTERSTELLAR_COLLATERAL_HAIRCUTS: Record<InterstellarCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.08,
  SSDR_BASKET: 1.15,
  TIER_1_EQUITIES: 1.30,
  KSCE_CREDITS: 1.45,
  ISCE_TACHYON: 1.55,
};

/**
 * Calculates net haircut-adjusted collateral valuation for interstellar multi-asset reserves.
 */
export function calculateInterstellarCollateralValue(
  pledgedAmountCents: number,
  assetType: InterstellarCollateralAsset,
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    INTERSTELLAR_COLLATERAL_HAIRCUTS,
    1.5,
  );
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel VII standards.
 */
export function evaluateBaselViiSolvency(
  input: BaselViiSolvencyInput,
): BaselViiSolvencyOutput {
  return evaluateTieredBaselSolvency(input, {
    standardLabel: 'Basel VII',
    signaturePrefix: 'BASEL_VII',
    minCet1Bps: GATE_17_SCALE_TARGETS.BASEL_VII_MIN_CET1_BPS,
    cet1Label: '22.00%',
    minLcrBps: GATE_17_SCALE_TARGETS.BASEL_VII_MIN_LCR_BPS,
    lcrLabel: '350.00%',
    minNsfrBps: GATE_17_SCALE_TARGETS.BASEL_VII_MIN_NSFR_BPS,
    nsfrLabel: '160.00%',
    targetBufferCents: GATE_17_SCALE_TARGETS.SOVEREIGN_BUFFER_TARGET_USD * 100,
    bufferLabel: '$10.0B',
    minSurvivalDays: 180,
    survivalLabel: '180-day',
  });
}
