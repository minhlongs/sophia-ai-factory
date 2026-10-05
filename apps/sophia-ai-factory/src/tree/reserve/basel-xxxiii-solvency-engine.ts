/**
 * @file basel-xxxiii-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXXIII Quingenti-Quadrillion Solvency & $5,000.0 Quadrillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  calculateParameterizedCollateralValue,
  calculateBaselSolvencyRatios,
  evaluateParameterizedBaselSolvency,
} from './basel-solvency-domain-engine';

import {
  GATE_43_SCALE_TARGETS,
  type BaselXxxiiiSolvencyStatus,
  type QuingentiquadrillionCollateralAsset,
} from '@/seed/types/quingentiquadrillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXxxiiiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxxiiiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXxxiiiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const QUINGENTIQUADRILLION_COLLATERAL_HAIRCUTS: Record<QuingentiquadrillionCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.01,
  PHYSICAL_GOLD: 1.015,
  SSDR_V25_BASKET: 1.025,
  TIER_1_EQUITIES: 1.05,
  QUINGENTIQUADRILLION_CREDITS: 1.08,
  QUINGENTIQUADRILLION_SUB_PLANCK_FOAM: 1.12,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Quingenti-Quadrillion sovereign reserves with BigInt precision.
 */
export function calculateQuingentiquadrillionCollateralValue(
  pledgedAmountCents: number,
  assetType: QuingentiquadrillionCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    QUINGENTIQUADRILLION_COLLATERAL_HAIRCUTS,
    1.40
  );
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXXIII standards.
 */
export function evaluateBaselXxxiiiSolvency(input: BaselXxxiiiSolvencyInput): BaselXxxiiiSolvencyOutput {
  const violations: string[] = [];

  const { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps } =
    calculateBaselSolvencyRatios(input);

  if (cet1RatioBps < GATE_43_SCALE_TARGETS.BASEL_XXXIII_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XXXIII requirement of ${GATE_43_SCALE_TARGETS.BASEL_XXXIII_MIN_CET1_BPS} bps (99.70%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_43_SCALE_TARGETS.BASEL_XXXIII_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XXXIII requirement of ${GATE_43_SCALE_TARGETS.BASEL_XXXIII_MIN_LCR_BPS} bps (40000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_43_SCALE_TARGETS.BASEL_XXXIII_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XXXIII requirement of ${GATE_43_SCALE_TARGETS.BASEL_XXXIII_MIN_NSFR_BPS} bps (8000.00%)`
    );
  }

  const targetBufferCents = GATE_43_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $5,000.0Q requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 7500000) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below 20,547-year requirement (7,500,000 days)`
    );
  }

  let solvencyStatus: BaselXxxiiiSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_43_SCALE_TARGETS.BASEL_XXXIII_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XXXIII:${isSolvent}:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
