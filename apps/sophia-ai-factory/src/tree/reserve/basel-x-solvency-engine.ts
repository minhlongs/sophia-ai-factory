/**
 * @file basel-x-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel X Pan-Cosmic Solvency & $100.0B Sovereign Reserve Grid.
 */

import { createHash } from 'node:crypto';
import {
  calculateParameterizedCollateralValue,
  calculateBaselSolvencyRatios,
  evaluateParameterizedBaselSolvency,
} from './basel-solvency-domain-engine';

import {
  GATE_20_SCALE_TARGETS,
  type BaselXSolvencyStatus,
  type PanCosmicCollateralAsset,
} from '@/seed/types/trans-omniverse-rtgs-capital';

export interface BaselXSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const PAN_COSMIC_COLLATERAL_HAIRCUTS: Record<PanCosmicCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.05,
  SSDR_V2_BASKET: 1.10,
  TIER_1_EQUITIES: 1.20,
  PAN_COSMIC_CREDITS: 1.30,
  ZERO_POINT_SINGULARITIES: 1.40,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Pan-Cosmic sovereign reserves.
 */
export function calculatePanCosmicCollateralValue(
  pledgedAmountCents: number,
  assetType: PanCosmicCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    PAN_COSMIC_COLLATERAL_HAIRCUTS,
    1.5
  );
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel X standards.
 */
export function evaluateBaselXSolvency(input: BaselXSolvencyInput): BaselXSolvencyOutput {
  const violations: string[] = [];

  const { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps } =
    calculateBaselSolvencyRatios(input);

  if (cet1RatioBps < GATE_20_SCALE_TARGETS.BASEL_X_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel X requirement of ${GATE_20_SCALE_TARGETS.BASEL_X_MIN_CET1_BPS} bps (30.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_20_SCALE_TARGETS.BASEL_X_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel X requirement of ${GATE_20_SCALE_TARGETS.BASEL_X_MIN_LCR_BPS} bps (600.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_20_SCALE_TARGETS.BASEL_X_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel X requirement of ${GATE_20_SCALE_TARGETS.BASEL_X_MIN_NSFR_BPS} bps (220.00%)`
    );
  }

  const targetBufferCents = GATE_20_SCALE_TARGETS.SOVEREIGN_RESERVE_GRID_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $100.0B requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 1095) {
    violations.push(
      `Stress test survival ${input.stressTestSurvivalDays} days is below 1,095 days (3 years) requirement`
    );
  }

  const isSolvent = violations.length === 0;

  let solvencyStatus: BaselXSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (!isSolvent) {
    if (cet1RatioBps < GATE_20_SCALE_TARGETS.BASEL_X_MIN_CET1_BPS) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_20_SCALE_TARGETS.BASEL_X_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_X_AUDIT:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
