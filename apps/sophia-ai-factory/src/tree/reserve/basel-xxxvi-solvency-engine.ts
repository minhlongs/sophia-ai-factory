/**
 * @file basel-xxxvi-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXXVI Quingenti-Millia-Quadrillion Solvency & $50,000.0Q Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
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
  const haircutFactor = QUINGENTIMILLIAQUADRILLION_COLLATERAL_HAIRCUTS[assetType] || 1.35;
  const factorScaled = BigInt(Math.round(haircutFactor * 10000));
  const pledgedScaled = BigInt(Math.round(pledgedAmountCents)) * 10000n;
  const netValuationCents = Number(pledgedScaled / factorScaled);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXXVI standards.
 */
export function evaluateBaselXxxviSolvency(input: BaselXxxviSolvencyInput): BaselXxxviSolvencyOutput {
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

  if (cet1RatioBps < GATE_46_SCALE_TARGETS.BASEL_XXXVI_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XXXVI requirement of ${GATE_46_SCALE_TARGETS.BASEL_XXXVI_MIN_CET1_BPS} bps (99.90%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_46_SCALE_TARGETS.BASEL_XXXVI_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XXXVI requirement of ${GATE_46_SCALE_TARGETS.BASEL_XXXVI_MIN_LCR_BPS} bps (75000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_46_SCALE_TARGETS.BASEL_XXXVI_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XXXVI requirement of ${GATE_46_SCALE_TARGETS.BASEL_XXXVI_MIN_NSFR_BPS} bps (15000.00%)`
    );
  }

  const targetBufferCents = GATE_46_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $50,000.0Q requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 15000000) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below 41,095-year requirement (15,000,000 days)`
    );
  }

  let solvencyStatus: BaselXxxviSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_46_SCALE_TARGETS.BASEL_XXXVI_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XXXVI:${isSolvent}:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
