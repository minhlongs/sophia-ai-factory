/**
 * @file basel-xxix-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXIX Ducenti-Quadrillion Solvency & $250.0 Quadrillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  calculateParameterizedCollateralValue,
  calculateBaselSolvencyRatios,
  evaluateParameterizedBaselSolvency,
} from './basel-solvency-domain-engine';

import {
  GATE_39_SCALE_TARGETS,
  type BaselXxixSolvencyStatus,
  type DucentiquadrillionCollateralAsset,
} from '@/seed/types/ducentiquadrillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXxixSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxixSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXxixSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const DUCENTIQUADRILLION_COLLATERAL_HAIRCUTS: Record<DucentiquadrillionCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.025,
  SSDR_V21_BASKET: 1.05,
  TIER_1_EQUITIES: 1.08,
  DUCENTIQUADRILLION_CREDITS: 1.15,
  DUCENTIQUADRILLION_SUB_PLANCK_FOAM: 1.25,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Ducenti-Quadrillion sovereign reserves with BigInt precision.
 */
export function calculateDucentiquadrillionCollateralValue(
  pledgedAmountCents: number,
  assetType: DucentiquadrillionCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    DUCENTIQUADRILLION_COLLATERAL_HAIRCUTS,
    1.45
  );
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXIX standards.
 */
export function evaluateBaselXxixSolvency(input: BaselXxixSolvencyInput): BaselXxixSolvencyOutput {
  const violations: string[] = [];

  const { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps } =
    calculateBaselSolvencyRatios(input);

  if (cet1RatioBps < GATE_39_SCALE_TARGETS.BASEL_XXIX_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XXIX requirement of ${GATE_39_SCALE_TARGETS.BASEL_XXIX_MIN_CET1_BPS} bps (98.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_39_SCALE_TARGETS.BASEL_XXIX_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XXIX requirement of ${GATE_39_SCALE_TARGETS.BASEL_XXIX_MIN_LCR_BPS} bps (20000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_39_SCALE_TARGETS.BASEL_XXIX_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XXIX requirement of ${GATE_39_SCALE_TARGETS.BASEL_XXIX_MIN_NSFR_BPS} bps (4500.00%)`
    );
  }

  const targetBufferCents = GATE_39_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $250.0Q requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 3500000) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below 9,589-year requirement (3,500,000 days)`
    );
  }

  let solvencyStatus: BaselXxixSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_39_SCALE_TARGETS.BASEL_XXIX_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XXIX:${isSolvent}:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
