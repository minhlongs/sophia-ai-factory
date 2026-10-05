/**
 * @file basel-xi-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XI Trans-Cosmic Solvency & $250.0B Sovereign Treasury Mesh.
 */

import { createHash } from 'node:crypto';
import {
  calculateParameterizedCollateralValue,
  calculateBaselSolvencyRatios,
  evaluateParameterizedBaselSolvency,
} from './basel-solvency-domain-engine';

import {
  GATE_21_SCALE_TARGETS,
  type BaselXiSolvencyStatus,
  type InterdimensionalCollateralAsset,
} from '@/seed/types/infinite-continuum-rtgs-capital';

export interface BaselXiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const INTERDIMENSIONAL_COLLATERAL_HAIRCUTS: Record<InterdimensionalCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.05,
  SSDR_V3_BASKET: 1.10,
  TIER_1_EQUITIES: 1.20,
  OMEGA_CREDITS: 1.30,
  ZERO_POINT_FOAM_SINGULARITIES: 1.40,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Inter-Dimensional sovereign reserves.
 */
export function calculateInterdimensionalCollateralValue(
  pledgedAmountCents: number,
  assetType: InterdimensionalCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    INTERDIMENSIONAL_COLLATERAL_HAIRCUTS,
    1.5
  );
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XI standards.
 */
export function evaluateBaselXiSolvency(input: BaselXiSolvencyInput): BaselXiSolvencyOutput {
  const violations: string[] = [];

  const { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps } =
    calculateBaselSolvencyRatios(input);

  if (cet1RatioBps < GATE_21_SCALE_TARGETS.BASEL_XI_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XI requirement of ${GATE_21_SCALE_TARGETS.BASEL_XI_MIN_CET1_BPS} bps (32.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_21_SCALE_TARGETS.BASEL_XI_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XI requirement of ${GATE_21_SCALE_TARGETS.BASEL_XI_MIN_LCR_BPS} bps (700.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_21_SCALE_TARGETS.BASEL_XI_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XI requirement of ${GATE_21_SCALE_TARGETS.BASEL_XI_MIN_NSFR_BPS} bps (250.00%)`
    );
  }

  const targetBufferCents = GATE_21_SCALE_TARGETS.SOVEREIGN_TREASURY_MESH_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $250.0B requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 1825) {
    violations.push(
      `Stress test survival ${input.stressTestSurvivalDays} days is below 1,825 days (5 years) requirement`
    );
  }

  const isSolvent = violations.length === 0;

  let solvencyStatus: BaselXiSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (!isSolvent) {
    if (cet1RatioBps < GATE_21_SCALE_TARGETS.BASEL_XI_MIN_CET1_BPS) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_21_SCALE_TARGETS.BASEL_XI_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XI_AUDIT:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
