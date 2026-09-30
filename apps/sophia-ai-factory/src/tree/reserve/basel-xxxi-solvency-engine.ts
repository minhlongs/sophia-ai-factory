/**
 * @file basel-xxxi-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXXI Centummillia-Quadrillion Solvency & $1,000.0 Quadrillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  GATE_41_SCALE_TARGETS,
  type BaselXxxiSolvencyStatus,
  type CentummilliaquadrillionCollateralAsset,
} from '@/seed/types/centummilliaquadrillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXxxiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxxiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXxxiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const CENTUMMILLIAQUADRILLION_COLLATERAL_HAIRCUTS: Record<CentummilliaquadrillionCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.015,
  PHYSICAL_GOLD: 1.02,
  SSDR_V23_BASKET: 1.04,
  TIER_1_EQUITIES: 1.07,
  CENTUMMILLIAQUADRILLION_CREDITS: 1.12,
  CENTUMMILLIAQUADRILLION_SUB_PLANCK_FOAM: 1.20,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Centummillia-Quadrillion sovereign reserves with BigInt precision.
 */
export function calculateCentummilliaquadrillionCollateralValue(
  pledgedAmountCents: number,
  assetType: CentummilliaquadrillionCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  const haircutFactor = CENTUMMILLIAQUADRILLION_COLLATERAL_HAIRCUTS[assetType] || 1.45;
  const factorScaled = BigInt(Math.round(haircutFactor * 10000));
  const pledgedScaled = BigInt(Math.round(pledgedAmountCents)) * 10000n;
  const netValuationCents = Number(pledgedScaled / factorScaled);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXXI standards.
 */
export function evaluateBaselXxxiSolvency(input: BaselXxxiSolvencyInput): BaselXxxiSolvencyOutput {
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

  if (cet1RatioBps < GATE_41_SCALE_TARGETS.BASEL_XXXI_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XXXI requirement of ${GATE_41_SCALE_TARGETS.BASEL_XXXI_MIN_CET1_BPS} bps (99.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_41_SCALE_TARGETS.BASEL_XXXI_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XXXI requirement of ${GATE_41_SCALE_TARGETS.BASEL_XXXI_MIN_LCR_BPS} bps (30000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_41_SCALE_TARGETS.BASEL_XXXI_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XXXI requirement of ${GATE_41_SCALE_TARGETS.BASEL_XXXI_MIN_NSFR_BPS} bps (6000.00%)`
    );
  }

  const targetBufferCents = GATE_41_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $1,000.0Q requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 5000000) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below 13,698-year requirement (5,000,000 days)`
    );
  }

  let solvencyStatus: BaselXxxiSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_41_SCALE_TARGETS.BASEL_XXXI_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XXXI:${isSolvent}:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
