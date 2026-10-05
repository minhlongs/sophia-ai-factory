/**
 * @file basel-xx-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XX Omnipresent Solvency & $250.0 Trillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  calculateParameterizedCollateralValue,
  calculateBaselSolvencyRatios,
  evaluateParameterizedBaselSolvency,
} from './basel-solvency-domain-engine';

import {
  GATE_30_SCALE_TARGETS,
  type BaselXxSolvencyStatus,
  type MetaverseCollateralAsset,
} from '@/seed/types/metaverse-hyper-rtgs-capital';

export interface BaselXxSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXxSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const METAVERSE_COLLATERAL_HAIRCUTS: Record<MetaverseCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.05,
  SSDR_V12_BASKET: 1.08,
  TIER_1_EQUITIES: 1.15,
  MULTIVERSE_CREDITS: 1.25,
  METAVERSE_SUB_PLANCK_FOAM: 1.40,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Metaverse sovereign reserves.
 */
export function calculateMetaverseCollateralValue(
  pledgedAmountCents: number,
  assetType: MetaverseCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    METAVERSE_COLLATERAL_HAIRCUTS,
    1.50
  );
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XX standards.
 */
export function evaluateBaselXxSolvency(input: BaselXxSolvencyInput): BaselXxSolvencyOutput {
  const violations: string[] = [];

  const { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps } =
    calculateBaselSolvencyRatios(input);

  if (cet1RatioBps < GATE_30_SCALE_TARGETS.BASEL_XX_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XX requirement of ${GATE_30_SCALE_TARGETS.BASEL_XX_MIN_CET1_BPS} bps (65.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_30_SCALE_TARGETS.BASEL_XX_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XX requirement of ${GATE_30_SCALE_TARGETS.BASEL_XX_MIN_LCR_BPS} bps (3500.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_30_SCALE_TARGETS.BASEL_XX_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XX requirement of ${GATE_30_SCALE_TARGETS.BASEL_XX_MIN_NSFR_BPS} bps (900.00%)`
    );
  }

  const targetBufferCents = GATE_30_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $250.0T requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 109500) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below 300-year minimum (109,500 days)`
    );
  }

  let solvencyStatus: BaselXxSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_30_SCALE_TARGETS.BASEL_XX_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XX_SOLVENCY:${isSolvent}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
