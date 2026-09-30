/**
 * @file basel-xxi-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXI Infinite Solvency & $500.0 Trillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  GATE_31_SCALE_TARGETS,
  type BaselXxiSolvencyStatus,
  type InfiniteCollateralAsset,
} from '@/seed/types/infinite-multiverse-hyper-rtgs-capital';

export interface BaselXxiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXxiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const INFINITE_COLLATERAL_HAIRCUTS: Record<InfiniteCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.05,
  SSDR_V13_BASKET: 1.08,
  TIER_1_EQUITIES: 1.15,
  MULTIVERSE_CREDITS: 1.25,
  INFINITE_SUB_PLANCK_FOAM: 1.40,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Infinite sovereign reserves.
 */
export function calculateInfiniteCollateralValue(
  pledgedAmountCents: number,
  assetType: InfiniteCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  const haircutFactor = INFINITE_COLLATERAL_HAIRCUTS[assetType] || 1.50;
  const netValuationCents = Math.round(pledgedAmountCents / haircutFactor);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXI standards.
 */
export function evaluateBaselXxiSolvency(input: BaselXxiSolvencyInput): BaselXxiSolvencyOutput {
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

  if (cet1RatioBps < GATE_31_SCALE_TARGETS.BASEL_XXI_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XXI requirement of ${GATE_31_SCALE_TARGETS.BASEL_XXI_MIN_CET1_BPS} bps (70.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_31_SCALE_TARGETS.BASEL_XXI_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XXI requirement of ${GATE_31_SCALE_TARGETS.BASEL_XXI_MIN_LCR_BPS} bps (4000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_31_SCALE_TARGETS.BASEL_XXI_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XXI requirement of ${GATE_31_SCALE_TARGETS.BASEL_XXI_MIN_NSFR_BPS} bps (1000.00%)`
    );
  }

  const targetBufferCents = GATE_31_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $500.0T requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 182500) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below 500-year minimum (182,500 days)`
    );
  }

  let solvencyStatus: BaselXxiSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_31_SCALE_TARGETS.BASEL_XXI_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XXI_SOLVENCY:${isSolvent}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
