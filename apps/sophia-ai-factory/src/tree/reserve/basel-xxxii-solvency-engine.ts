/**
 * @file basel-xxxii-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXXII Ducenti-Quinquaginta-Quadrillion Solvency & $2,500.0 Quadrillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  calculateParameterizedCollateralValue,
  calculateBaselSolvencyRatios,
} from './basel-solvency-domain-engine';

import {
  GATE_42_SCALE_TARGETS,
  type BaselXxxiiSolvencyStatus,
  type DucentiquinquagintaquadrillionCollateralAsset,
} from '@/seed/types/ducentiquinquagintaquadrillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXxxiiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxxiiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXxxiiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const DUCENTIQUINQUAGINTAQUADRILLION_COLLATERAL_HAIRCUTS: Record<DucentiquinquagintaquadrillionCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.01,
  PHYSICAL_GOLD: 1.015,
  SSDR_V24_BASKET: 1.03,
  TIER_1_EQUITIES: 1.06,
  DUCENTIQUINQUAGINTAQUADRILLION_CREDITS: 1.10,
  DUCENTIQUINQUAGINTAQUADRILLION_SUB_PLANCK_FOAM: 1.15,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Ducenti-Quinquaginta-Quadrillion sovereign reserves with BigInt precision.
 */
export function calculateDucentiquinquagintaquadrillionCollateralValue(
  pledgedAmountCents: number,
  assetType: DucentiquinquagintaquadrillionCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    DUCENTIQUINQUAGINTAQUADRILLION_COLLATERAL_HAIRCUTS,
    1.45
  );
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXXII standards.
 */
export function evaluateBaselXxxiiSolvency(input: BaselXxxiiSolvencyInput): BaselXxxiiSolvencyOutput {
  const violations: string[] = [];

  const { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps } =
    calculateBaselSolvencyRatios(input);

  if (cet1RatioBps < GATE_42_SCALE_TARGETS.BASEL_XXXII_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XXXII requirement of ${GATE_42_SCALE_TARGETS.BASEL_XXXII_MIN_CET1_BPS} bps (99.50%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_42_SCALE_TARGETS.BASEL_XXXII_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XXXII requirement of ${GATE_42_SCALE_TARGETS.BASEL_XXXII_MIN_LCR_BPS} bps (35000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_42_SCALE_TARGETS.BASEL_XXXII_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XXXII requirement of ${GATE_42_SCALE_TARGETS.BASEL_XXXII_MIN_NSFR_BPS} bps (7000.00%)`
    );
  }

  const targetBufferCents = GATE_42_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $2,500.0Q requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 6000000) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below 16,438-year requirement (6,000,000 days)`
    );
  }

  let solvencyStatus: BaselXxxiiSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_42_SCALE_TARGETS.BASEL_XXXII_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XXXII:${isSolvent}:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
