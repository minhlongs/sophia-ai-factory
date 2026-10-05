/**
 * @file basel-xxv-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXV Deca-Quadrillion Solvency & $10.0 Quadrillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  calculateParameterizedCollateralValue,
  calculateBaselSolvencyRatios,
} from './basel-solvency-domain-engine';

import {
  GATE_35_SCALE_TARGETS,
  type BaselXxvSolvencyStatus,
  type DecaquadrillionCollateralAsset,
} from '@/seed/types/decaquadrillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXxvSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxvSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXxvSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const DECAQUADRILLION_COLLATERAL_HAIRCUTS: Record<DecaquadrillionCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.03,
  SSDR_V17_BASKET: 1.06,
  TIER_1_EQUITIES: 1.10,
  DECAQUADRILLION_CREDITS: 1.18,
  DECAQUADRILLION_SUB_PLANCK_FOAM: 1.30,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Deca-Quadrillion sovereign reserves with BigInt precision.
 */
export function calculateDecaquadrillionCollateralValue(
  pledgedAmountCents: number,
  assetType: DecaquadrillionCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    DECAQUADRILLION_COLLATERAL_HAIRCUTS,
    1.45
  );
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXV standards.
 */
export function evaluateBaselXxvSolvency(input: BaselXxvSolvencyInput): BaselXxvSolvencyOutput {
  const violations: string[] = [];

  const { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps } =
    calculateBaselSolvencyRatios(input);

  if (cet1RatioBps < GATE_35_SCALE_TARGETS.BASEL_XXV_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XXV requirement of ${GATE_35_SCALE_TARGETS.BASEL_XXV_MIN_CET1_BPS} bps (90.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_35_SCALE_TARGETS.BASEL_XXV_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XXV requirement of ${GATE_35_SCALE_TARGETS.BASEL_XXV_MIN_LCR_BPS} bps (10000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_35_SCALE_TARGETS.BASEL_XXV_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XXV requirement of ${GATE_35_SCALE_TARGETS.BASEL_XXV_MIN_NSFR_BPS} bps (2500.00%)`
    );
  }

  const targetBufferCents = GATE_35_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $10.0Q requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 1500000) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below 4,110-year requirement (1,500,000 days)`
    );
  }

  let solvencyStatus: BaselXxvSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_35_SCALE_TARGETS.BASEL_XXV_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XXV:${isSolvent}:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
