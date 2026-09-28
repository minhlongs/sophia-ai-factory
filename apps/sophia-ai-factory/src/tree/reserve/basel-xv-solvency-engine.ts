/**
 * @file basel-xv-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XV Omniverse Solvency & $5.0 Trillion Multiverse Treasury Singularity.
 */

import { createHash } from 'node:crypto';
import {
  GATE_25_SCALE_TARGETS,
  type BaselXvSolvencyStatus,
  type OmniverseCollateralAsset,
} from '@/seed/types/omniverse-hyper-rtgs-capital';

export interface BaselXvSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXvSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXvSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const OMNIVERSE_COLLATERAL_HAIRCUTS: Record<OmniverseCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.05,
  SSDR_V7_BASKET: 1.08,
  TIER_1_EQUITIES: 1.15,
  MULTIVERSE_CREDITS: 1.25,
  TRANSCENDENTAL_VACUUM_SINGULARITIES: 1.35,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Omniverse sovereign reserves.
 */
export function calculateOmniverseCollateralValue(
  pledgedAmountCents: number,
  assetType: OmniverseCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  const haircutFactor = OMNIVERSE_COLLATERAL_HAIRCUTS[assetType] || 1.45;
  const netValuationCents = Math.round(pledgedAmountCents / haircutFactor);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XV standards.
 */
export function evaluateBaselXvSolvency(input: BaselXvSolvencyInput): BaselXvSolvencyOutput {
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

  if (cet1RatioBps < GATE_25_SCALE_TARGETS.BASEL_XV_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XV requirement of ${GATE_25_SCALE_TARGETS.BASEL_XV_MIN_CET1_BPS} bps (42.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_25_SCALE_TARGETS.BASEL_XV_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XV requirement of ${GATE_25_SCALE_TARGETS.BASEL_XV_MIN_LCR_BPS} bps (1200.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_25_SCALE_TARGETS.BASEL_XV_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XV requirement of ${GATE_25_SCALE_TARGETS.BASEL_XV_MIN_NSFR_BPS} bps (450.00%)`
    );
  }

  const targetBufferCents = GATE_25_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $5.0T requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 7300) {
    violations.push(
      `Stress test survival ${input.stressTestSurvivalDays} days is below 7,300 days (20 years) requirement`
    );
  }

  const isSolvent = violations.length === 0;

  let solvencyStatus: BaselXvSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (!isSolvent) {
    if (cet1RatioBps < GATE_25_SCALE_TARGETS.BASEL_XV_MIN_CET1_BPS) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_25_SCALE_TARGETS.BASEL_XV_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XV_AUDIT:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
