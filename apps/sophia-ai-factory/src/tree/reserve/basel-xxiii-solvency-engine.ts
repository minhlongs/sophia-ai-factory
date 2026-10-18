/**
 * @file basel-xxiii-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXIII Bi-Quadrillion Solvency & $2.0 Quadrillion Sovereign Reserve Singularity.
 */

import { calculateParameterizedCollateralValue } from './basel-solvency-domain-engine';
import { evaluateTransCosmicBaselSolvency } from './basel-trans-cosmic-solvency-helper';

import {
  GATE_33_SCALE_TARGETS,
  type BaselXxiiiSolvencyStatus,
  type BiquadrillionCollateralAsset,
} from '@/seed/types/biquadrillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXxiiiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxiiiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXxiiiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const BIQUADRILLION_COLLATERAL_HAIRCUTS: Record<BiquadrillionCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.05,
  SSDR_V15_BASKET: 1.08,
  TIER_1_EQUITIES: 1.15,
  BIQUADRILLION_CREDITS: 1.25,
  BIQUADRILLION_SUB_PLANCK_FOAM: 1.40,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Bi-Quadrillion sovereign reserves.
 */
export function calculateBiquadrillionCollateralValue(
  pledgedAmountCents: number,
  assetType: BiquadrillionCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    BIQUADRILLION_COLLATERAL_HAIRCUTS,
    1.50
  );
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXIII standards.
 */
export function evaluateBaselXxiiiSolvency(input: BaselXxiiiSolvencyInput): BaselXxiiiSolvencyOutput {
  return evaluateTransCosmicBaselSolvency<BaselXxiiiSolvencyStatus>(input, {
    tierName: 'Basel XXIII',
    minCet1Bps: GATE_33_SCALE_TARGETS.BASEL_XXIII_MIN_CET1_BPS,
    cet1PctLabel: '80.00%',
    minLcrBps: GATE_33_SCALE_TARGETS.BASEL_XXIII_MIN_LCR_BPS,
    lcrPctLabel: '6000.00%',
    minNsfrBps: GATE_33_SCALE_TARGETS.BASEL_XXIII_MIN_NSFR_BPS,
    nsfrPctLabel: '1500.00%',
    targetBufferCents: GATE_33_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100,
    bufferViolationMessage: (actual, target) =>
      `Sovereign capital buffer ${actual} cents is below $2.0Q requirement (${target} cents)`,
    minSurvivalDays: 730000,
    survivalViolationMessage: (actual) =>
      `Stress test survival horizon ${actual} days is below 2,000-year requirement (730,000 days)`,
    buildSignaturePayload: (ctx) =>
      `BASEL_XXIII:${ctx.isSolvent}:${ctx.solvencyStatus}:${ctx.cet1RatioBps}:${ctx.liquidityCoverageRatioBps}:${ctx.netStableFundingRatioBps}:${ctx.sovereignCapitalBufferCents}:${ctx.stressTestSurvivalDays}`,
  });
}
