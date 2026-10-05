/**
 * @file basel-xix-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XIX Pan-Dimensional Solvency & $100.0 Trillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  calculateParameterizedCollateralValue,
  calculateBaselSolvencyRatios,
  evaluateParameterizedBaselSolvency,
} from './basel-solvency-domain-engine';

import {
  GATE_29_SCALE_TARGETS,
  type BaselXixSolvencyStatus,
  type PanDimensionalCollateralAsset,
} from '@/seed/types/pan-dimensional-hyper-rtgs-capital';

export interface BaselXixSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXixSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXixSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const PAN_DIMENSIONAL_COLLATERAL_HAIRCUTS: Record<PanDimensionalCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.05,
  SSDR_V11_BASKET: 1.08,
  TIER_1_EQUITIES: 1.15,
  MULTIVERSE_CREDITS: 1.25,
  PAN_DIMENSIONAL_SUB_PLANCK_FOAM: 1.40,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Pan-Dimensional sovereign reserves.
 */
export function calculatePanDimensionalCollateralValue(
  pledgedAmountCents: number,
  assetType: PanDimensionalCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    PAN_DIMENSIONAL_COLLATERAL_HAIRCUTS,
    1.50
  );
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XIX standards.
 */
export function evaluateBaselXixSolvency(input: BaselXixSolvencyInput): BaselXixSolvencyOutput {
  const violations: string[] = [];

  const { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps } =
    calculateBaselSolvencyRatios(input);

  if (cet1RatioBps < GATE_29_SCALE_TARGETS.BASEL_XIX_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XIX requirement of ${GATE_29_SCALE_TARGETS.BASEL_XIX_MIN_CET1_BPS} bps (60.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_29_SCALE_TARGETS.BASEL_XIX_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XIX requirement of ${GATE_29_SCALE_TARGETS.BASEL_XIX_MIN_LCR_BPS} bps (3000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_29_SCALE_TARGETS.BASEL_XIX_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XIX requirement of ${GATE_29_SCALE_TARGETS.BASEL_XIX_MIN_NSFR_BPS} bps (800.00%)`
    );
  }

  const targetBufferCents = GATE_29_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $100.0T requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 73000) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below 200-year minimum (73,000 days)`
    );
  }

  let solvencyStatus: BaselXixSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_29_SCALE_TARGETS.BASEL_XIX_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XIX_SOLVENCY:${isSolvent}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
