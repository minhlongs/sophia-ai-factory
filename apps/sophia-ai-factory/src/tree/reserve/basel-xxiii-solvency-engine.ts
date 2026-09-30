/**
 * @file basel-xxiii-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXIII Bi-Quadrillion Solvency & $2.0 Quadrillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
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
  const haircutFactor = BIQUADRILLION_COLLATERAL_HAIRCUTS[assetType] || 1.50;
  const netValuationCents = Math.round(pledgedAmountCents / haircutFactor);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXIII standards.
 */
export function evaluateBaselXxiiiSolvency(input: BaselXxiiiSolvencyInput): BaselXxiiiSolvencyOutput {
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

  if (cet1RatioBps < GATE_33_SCALE_TARGETS.BASEL_XXIII_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XXIII requirement of ${GATE_33_SCALE_TARGETS.BASEL_XXIII_MIN_CET1_BPS} bps (80.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_33_SCALE_TARGETS.BASEL_XXIII_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XXIII requirement of ${GATE_33_SCALE_TARGETS.BASEL_XXIII_MIN_LCR_BPS} bps (6000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_33_SCALE_TARGETS.BASEL_XXIII_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XXIII requirement of ${GATE_33_SCALE_TARGETS.BASEL_XXIII_MIN_NSFR_BPS} bps (1500.00%)`
    );
  }

  const targetBufferCents = GATE_33_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $2.0Q requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 730000) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below 2,000-year requirement (730,000 days)`
    );
  }

  let solvencyStatus: BaselXxiiiSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_33_SCALE_TARGETS.BASEL_XXIII_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XXIII:${isSolvent}:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
