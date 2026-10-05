/**
 * @file basel-xvii-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XVII Omni-Cosmic Solvency & $25.0 Trillion Treasury Singularity.
 */

import { createHash } from 'node:crypto';
import {
  calculateParameterizedCollateralValue,
  calculateBaselSolvencyRatios,
} from './basel-solvency-domain-engine';

import {
  GATE_27_SCALE_TARGETS,
  type BaselXviiSolvencyStatus,
  type OmniCosmicCollateralAsset,
} from '@/seed/types/omni-cosmic-hyper-rtgs-capital';

export interface BaselXviiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXviiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXviiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const OMNI_COSMIC_COLLATERAL_HAIRCUTS: Record<OmniCosmicCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.05,
  SSDR_V9_BASKET: 1.08,
  TIER_1_EQUITIES: 1.15,
  MULTIVERSE_CREDITS: 1.25,
  OMNI_DIMENSIONAL_PLANCK_FOAM: 1.40,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Omni-Cosmic sovereign reserves.
 */
export function calculateOmniCosmicCollateralValue(
  pledgedAmountCents: number,
  assetType: OmniCosmicCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    OMNI_COSMIC_COLLATERAL_HAIRCUTS,
    1.50
  );
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XVII standards.
 */
export function evaluateBaselXviiSolvency(input: BaselXviiSolvencyInput): BaselXviiSolvencyOutput {
  const violations: string[] = [];

  const { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps } =
    calculateBaselSolvencyRatios(input);

  if (cet1RatioBps < GATE_27_SCALE_TARGETS.BASEL_XVII_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XVII requirement of ${GATE_27_SCALE_TARGETS.BASEL_XVII_MIN_CET1_BPS} bps (50.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_27_SCALE_TARGETS.BASEL_XVII_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XVII requirement of ${GATE_27_SCALE_TARGETS.BASEL_XVII_MIN_LCR_BPS} bps (2000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_27_SCALE_TARGETS.BASEL_XVII_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XVII requirement of ${GATE_27_SCALE_TARGETS.BASEL_XVII_MIN_NSFR_BPS} bps (600.00%)`
    );
  }

  const targetBufferCents = GATE_27_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $25.0T requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 18250) {
    violations.push(
      `Stress test survival ${input.stressTestSurvivalDays} days is below 18,250 days (50 years) requirement`
    );
  }

  const isSolvent = violations.length === 0;

  let solvencyStatus: BaselXviiSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (!isSolvent) {
    if (cet1RatioBps < GATE_27_SCALE_TARGETS.BASEL_XVII_MIN_CET1_BPS) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_27_SCALE_TARGETS.BASEL_XVII_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XVII_AUDIT:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
