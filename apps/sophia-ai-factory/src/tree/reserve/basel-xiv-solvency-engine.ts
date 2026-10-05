/**
 * @file basel-xiv-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XIV Pan-Galactic Solvency & $2.0 Trillion Multiverse Treasury Singularity.
 */

import { createHash } from 'node:crypto';
import {
  calculateParameterizedCollateralValue,
  calculateBaselSolvencyRatios,
} from './basel-solvency-domain-engine';

import {
  GATE_24_SCALE_TARGETS,
  type BaselXivSolvencyStatus,
  type PanGalacticCollateralAsset,
} from '@/seed/types/pan-galactic-hyper-rtgs-capital';

export interface BaselXivSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXivSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXivSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const PAN_GALACTIC_COLLATERAL_HAIRCUTS: Record<PanGalacticCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.05,
  SSDR_V6_BASKET: 1.08,
  TIER_1_EQUITIES: 1.15,
  MULTIVERSE_CREDITS: 1.25,
  ABSOLUTE_VACUUM_SINGULARITIES: 1.35,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Pan-Galactic sovereign reserves.
 */
export function calculatePanGalacticCollateralValue(
  pledgedAmountCents: number,
  assetType: PanGalacticCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    PAN_GALACTIC_COLLATERAL_HAIRCUTS,
    1.45
  );
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XIV standards.
 */
export function evaluateBaselXivSolvency(input: BaselXivSolvencyInput): BaselXivSolvencyOutput {
  const violations: string[] = [];

  const { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps } =
    calculateBaselSolvencyRatios(input);

  if (cet1RatioBps < GATE_24_SCALE_TARGETS.BASEL_XIV_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XIV requirement of ${GATE_24_SCALE_TARGETS.BASEL_XIV_MIN_CET1_BPS} bps (40.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_24_SCALE_TARGETS.BASEL_XIV_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XIV requirement of ${GATE_24_SCALE_TARGETS.BASEL_XIV_MIN_LCR_BPS} bps (1000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_24_SCALE_TARGETS.BASEL_XIV_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XIV requirement of ${GATE_24_SCALE_TARGETS.BASEL_XIV_MIN_NSFR_BPS} bps (400.00%)`
    );
  }

  const targetBufferCents = GATE_24_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $2.0T requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 5475) {
    violations.push(
      `Stress test survival ${input.stressTestSurvivalDays} days is below 5,475 days (15 years) requirement`
    );
  }

  const isSolvent = violations.length === 0;

  let solvencyStatus: BaselXivSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (!isSolvent) {
    if (cet1RatioBps < GATE_24_SCALE_TARGETS.BASEL_XIV_MIN_CET1_BPS) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_24_SCALE_TARGETS.BASEL_XIV_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XIV_AUDIT:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
