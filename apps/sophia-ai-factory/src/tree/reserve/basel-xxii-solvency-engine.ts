/**
 * @file basel-xxii-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXII Quadrillion Trans-Cosmic Solvency & $1.0 Quadrillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  calculateParameterizedCollateralValue,
  calculateBaselSolvencyRatios,
} from './basel-solvency-domain-engine';

import {
  GATE_32_SCALE_TARGETS,
  type BaselXxiiSolvencyStatus,
  type QuadrillionCollateralAsset,
} from '@/seed/types/quadrillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXxiiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxiiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXxiiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const QUADRILLION_COLLATERAL_HAIRCUTS: Record<QuadrillionCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.05,
  SSDR_V14_BASKET: 1.08,
  TIER_1_EQUITIES: 1.15,
  QUADRILLION_CREDITS: 1.25,
  QUADRILLION_SUB_PLANCK_FOAM: 1.40,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Quadrillion sovereign reserves.
 */
export function calculateQuadrillionCollateralValue(
  pledgedAmountCents: number,
  assetType: QuadrillionCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    QUADRILLION_COLLATERAL_HAIRCUTS,
    1.50
  );
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXII standards.
 */
export function evaluateBaselXxiiSolvency(input: BaselXxiiSolvencyInput): BaselXxiiSolvencyOutput {
  const violations: string[] = [];

  const { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps } =
    calculateBaselSolvencyRatios(input);

  if (cet1RatioBps < GATE_32_SCALE_TARGETS.BASEL_XXII_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XXII requirement of ${GATE_32_SCALE_TARGETS.BASEL_XXII_MIN_CET1_BPS} bps (75.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_32_SCALE_TARGETS.BASEL_XXII_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XXII requirement of ${GATE_32_SCALE_TARGETS.BASEL_XXII_MIN_LCR_BPS} bps (5000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_32_SCALE_TARGETS.BASEL_XXII_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XXII requirement of ${GATE_32_SCALE_TARGETS.BASEL_XXII_MIN_NSFR_BPS} bps (1200.00%)`
    );
  }

  const targetBufferCents = GATE_32_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $1.0Q requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 365000) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below 1,000-year requirement (365,000 days)`
    );
  }

  let solvencyStatus: BaselXxiiSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_32_SCALE_TARGETS.BASEL_XXII_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XXII:${isSolvent}:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
