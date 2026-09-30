/**
 * @file basel-xxvi-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXVI Viginti-Quadrillion Solvency & $20.0 Quadrillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  GATE_36_SCALE_TARGETS,
  type BaselXxviSolvencyStatus,
  type VigintiquadrillionCollateralAsset,
} from '@/seed/types/vigintiquadrillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXxviSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxviSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXxviSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const VIGINTIQUADRILLION_COLLATERAL_HAIRCUTS: Record<VigintiquadrillionCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.025,
  SSDR_V18_BASKET: 1.05,
  TIER_1_EQUITIES: 1.08,
  VIGINTIQUADRILLION_CREDITS: 1.15,
  VIGINTIQUADRILLION_SUB_PLANCK_FOAM: 1.25,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Viginti-Quadrillion sovereign reserves with BigInt precision.
 */
export function calculateVigintiquadrillionCollateralValue(
  pledgedAmountCents: number,
  assetType: VigintiquadrillionCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  const haircutFactor = VIGINTIQUADRILLION_COLLATERAL_HAIRCUTS[assetType] || 1.45;
  const factorScaled = BigInt(Math.round(haircutFactor * 10000));
  const pledgedScaled = BigInt(Math.round(pledgedAmountCents)) * 10000n;
  const netValuationCents = Number(pledgedScaled / factorScaled);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXVI standards.
 */
export function evaluateBaselXxviSolvency(input: BaselXxviSolvencyInput): BaselXxviSolvencyOutput {
  const violations: string[] = [];

  const cet1RatioBps =
    input.totalRiskExposureCents > 0
      ? Math.floor((input.commonEquityTier1Cents / input.totalRiskExposureCents) * 10000)
      : 0;

  const liquidityCoverageRatioBps =
    input.netCashOutflows30DaysCents > 0
      ? Math.floor((input.highQualityLiquidAssetsCents / input.netCashOutflows30DaysCents) * 10000)
      : 0;

  const netStableFundingRatioBps =
    input.requiredStableFundingCents > 0
      ? Math.floor((input.availableStableFundingCents / input.requiredStableFundingCents) * 10000)
      : 0;

  if (cet1RatioBps < GATE_36_SCALE_TARGETS.BASEL_XXVI_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XXVI requirement of ${GATE_36_SCALE_TARGETS.BASEL_XXVI_MIN_CET1_BPS} bps (92.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_36_SCALE_TARGETS.BASEL_XXVI_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XXVI requirement of ${GATE_36_SCALE_TARGETS.BASEL_XXVI_MIN_LCR_BPS} bps (12000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_36_SCALE_TARGETS.BASEL_XXVI_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XXVI requirement of ${GATE_36_SCALE_TARGETS.BASEL_XXVI_MIN_NSFR_BPS} bps (3000.00%)`
    );
  }

  const targetBufferCents = GATE_36_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $20.0Q requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 2000000) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below 5,479-year requirement (2,000,000 days)`
    );
  }

  let solvencyStatus: BaselXxviSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_36_SCALE_TARGETS.BASEL_XXVI_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XXVI:${isSolvent}:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
    )
    .digest('hex');

  return {
    isSolvent,
    solvencyStatus,
    cet1RatioBps,
    liquidityCoverageRatioBps,
    netStableFundingRatioBps,
    sovereignCapitalBufferCents: input.sovereignCapitalBufferCents,
    stressTestSurvivalDays: input.stressTestSurvivalDays,
    violations,
    supervisorySignature,
  };
}
