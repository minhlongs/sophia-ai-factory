/**
 * @file basel-xviii-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XVIII Inter-Galactic Solvency & $50.0 Trillion Treasury Singularity.
 */

import { createHash } from 'node:crypto';
import {
  GATE_28_SCALE_TARGETS,
  type BaselXviiiSolvencyStatus,
  type InterGalacticCollateralAsset,
} from '@/seed/types/inter-galactic-hyper-rtgs-capital';

export interface BaselXviiiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXviiiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXviiiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const INTER_GALACTIC_COLLATERAL_HAIRCUTS: Record<InterGalacticCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.05,
  SSDR_V10_BASKET: 1.08,
  TIER_1_EQUITIES: 1.15,
  MULTIVERSE_CREDITS: 1.25,
  INTER_GALACTIC_SUB_PLANCK_FOAM: 1.40,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Inter-Galactic sovereign reserves.
 */
export function calculateInterGalacticCollateralValue(
  pledgedAmountCents: number,
  assetType: InterGalacticCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  const haircutFactor = INTER_GALACTIC_COLLATERAL_HAIRCUTS[assetType] || 1.50;
  const netValuationCents = Math.round(pledgedAmountCents / haircutFactor);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XVIII standards.
 */
export function evaluateBaselXviiiSolvency(input: BaselXviiiSolvencyInput): BaselXviiiSolvencyOutput {
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

  if (cet1RatioBps < GATE_28_SCALE_TARGETS.BASEL_XVIII_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XVIII requirement of ${GATE_28_SCALE_TARGETS.BASEL_XVIII_MIN_CET1_BPS} bps (55.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_28_SCALE_TARGETS.BASEL_XVIII_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XVIII requirement of ${GATE_28_SCALE_TARGETS.BASEL_XVIII_MIN_LCR_BPS} bps (2500.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_28_SCALE_TARGETS.BASEL_XVIII_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XVIII requirement of ${GATE_28_SCALE_TARGETS.BASEL_XVIII_MIN_NSFR_BPS} bps (700.00%)`
    );
  }

  const targetBufferCents = GATE_28_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $50.0T requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 36500) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below 100-year minimum (36,500 days)`
    );
  }

  let solvencyStatus: BaselXviiiSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_28_SCALE_TARGETS.BASEL_XVIII_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XVIII_SOLVENCY:${isSolvent}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
