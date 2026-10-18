/**
 * @file basel-xxxvi-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXXVI Quingenti-Millia-Quadrillion Solvency & $50,000.0Q Sovereign Reserve Singularity.
 */

import {
  calculateParameterizedCollateralValue,
} from './basel-solvency-domain-engine';
import { evaluateTransCosmicBaselSolvency } from './basel-trans-cosmic-solvency-helper';

import {
  GATE_46_SCALE_TARGETS,
  type BaselXxxviSolvencyStatus,
  type QuingentimilliaquadrillionCollateralAsset,
} from '@/seed/types/quingentimilliaquadrillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXxxviSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxxviSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXxxviSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const QUINGENTIMILLIAQUADRILLION_COLLATERAL_HAIRCUTS: Record<
  QuingentimilliaquadrillionCollateralAsset,
  number
> = {
  SOVEREIGN_BONDS: 1.004,
  PHYSICAL_GOLD: 1.008,
  SSDR_V28_BASKET: 1.012,
  TIER_1_EQUITIES: 1.025,
  QUINGENTIMILLIAQUADRILLION_CREDITS: 1.04,
  QUINGENTIMILLIAQUADRILLION_SUB_PLANCK_FOAM: 1.06,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Quingenti-Millia-Quadrillion sovereign reserves with BigInt precision.
 */
export function calculateQuingentimilliaquadrillionCollateralValue(
  pledgedAmountCents: number,
  assetType: QuingentimilliaquadrillionCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    QUINGENTIMILLIAQUADRILLION_COLLATERAL_HAIRCUTS,
    1.35
  );
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXXVI standards.
 */
export function evaluateBaselXxxviSolvency(input: BaselXxxviSolvencyInput): BaselXxxviSolvencyOutput {
  return evaluateTransCosmicBaselSolvency<BaselXxxviSolvencyStatus>(input, {
    tierName: 'Basel XXXVI',
    minCet1Bps: GATE_46_SCALE_TARGETS.BASEL_XXXVI_MIN_CET1_BPS,
    cet1PctLabel: '99.90%',
    minLcrBps: GATE_46_SCALE_TARGETS.BASEL_XXXVI_MIN_LCR_BPS,
    lcrPctLabel: '75000.00%',
    minNsfrBps: GATE_46_SCALE_TARGETS.BASEL_XXXVI_MIN_NSFR_BPS,
    nsfrPctLabel: '15000.00%',
    targetBufferCents: GATE_46_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100,
    bufferViolationMessage: (actual, target) =>
      `Sovereign capital buffer ${actual} cents is below $50,000.0Q requirement (${target} cents)`,
    minSurvivalDays: 15000000,
    survivalViolationMessage: (actual) =>
      `Stress test survival horizon ${actual} days is below 41,095-year requirement (15,000,000 days)`,
    buildSignaturePayload: (ctx) =>
      `BASEL_XXXVI:${ctx.isSolvent}:${ctx.solvencyStatus}:${ctx.cet1RatioBps}:${ctx.liquidityCoverageRatioBps}:${ctx.netStableFundingRatioBps}:${ctx.sovereignCapitalBufferCents}:${ctx.stressTestSurvivalDays}`,
  });
}
