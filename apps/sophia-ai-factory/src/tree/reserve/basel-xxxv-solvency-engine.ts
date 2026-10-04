/**
 * @file basel-xxxv-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXXV Ducenti-Quinquaginta-Millia-Quadrillion Solvency & $25,000.0 Quadrillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  GATE_45_SCALE_TARGETS,
  type BaselXxxvSolvencyStatus,
  type DucentiquinquagintamilliaquadrillionCollateralAsset,
} from '@/seed/types/ducentiquinquagintamilliaquadrillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXxxvSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxxvSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXxxvSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const DUCENTIQUINQUAGINTAMILLIAQUADRILLION_COLLATERAL_HAIRCUTS: Record<
  DucentiquinquagintamilliaquadrillionCollateralAsset,
  number
> = {
  SOVEREIGN_BONDS: 1.005,
  PHYSICAL_GOLD: 1.010,
  SSDR_V27_BASKET: 1.015,
  TIER_1_EQUITIES: 1.03,
  DUCENTIQUINQUAGINTAMILLIAQUADRILLION_CREDITS: 1.05,
  DUCENTIQUINQUAGINTAMILLIAQUADRILLION_SUB_PLANCK_FOAM: 1.08,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Ducenti-Quinquaginta-Millia-Quadrillion sovereign reserves with BigInt precision.
 */
export function calculateDucentiquinquagintamilliaquadrillionCollateralValue(
  pledgedAmountCents: number,
  assetType: DucentiquinquagintamilliaquadrillionCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  const haircutFactor = DUCENTIQUINQUAGINTAMILLIAQUADRILLION_COLLATERAL_HAIRCUTS[assetType] || 1.35;
  const factorScaled = BigInt(Math.round(haircutFactor * 10000));
  const pledgedScaled = BigInt(Math.round(pledgedAmountCents)) * 10000n;
  const netValuationCents = Number(pledgedScaled / factorScaled);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXXV standards.
 */
export function evaluateBaselXxxvSolvency(input: BaselXxxvSolvencyInput): BaselXxxvSolvencyOutput {
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

  if (cet1RatioBps < GATE_45_SCALE_TARGETS.BASEL_XXXV_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XXXV requirement of ${GATE_45_SCALE_TARGETS.BASEL_XXXV_MIN_CET1_BPS} bps (99.85%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_45_SCALE_TARGETS.BASEL_XXXV_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XXXV requirement of ${GATE_45_SCALE_TARGETS.BASEL_XXXV_MIN_LCR_BPS} bps (60000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_45_SCALE_TARGETS.BASEL_XXXV_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XXXV requirement of ${GATE_45_SCALE_TARGETS.BASEL_XXXV_MIN_NSFR_BPS} bps (12000.00%)`
    );
  }

  const targetBufferCents = GATE_45_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $25,000.0Q requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 12500000) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below 34,246-year requirement (12,500,000 days)`
    );
  }

  let solvencyStatus: BaselXxxvSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_45_SCALE_TARGETS.BASEL_XXXV_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XXXV:${isSolvent}:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
