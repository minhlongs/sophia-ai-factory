/**
 * @file basel-xii-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XII Omnipresent Solvency & $500.0B Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  GATE_22_SCALE_TARGETS,
  type BaselXiiSolvencyStatus,
  type MultiverseCollateralAsset,
} from '@/seed/types/omnipresent-hyper-rtgs-capital';

export interface BaselXiiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXiiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXiiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const MULTIVERSE_COLLATERAL_HAIRCUTS: Record<MultiverseCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.05,
  SSDR_V4_BASKET: 1.08,
  TIER_1_EQUITIES: 1.15,
  MULTIVERSE_CREDITS: 1.25,
  SUB_PLANCK_VACUUM_SINGULARITIES: 1.35,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Multiverse sovereign reserves.
 */
export function calculateMultiverseCollateralValue(
  pledgedAmountCents: number,
  assetType: MultiverseCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  const haircutFactor = MULTIVERSE_COLLATERAL_HAIRCUTS[assetType] || 1.45;
  const netValuationCents = Math.floor(pledgedAmountCents / haircutFactor);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XII standards.
 */
export function evaluateBaselXiiSolvency(input: BaselXiiSolvencyInput): BaselXiiSolvencyOutput {
  const violations: string[] = [];

  const cet1RatioBps =
    input.totalRiskExposureCents > 0
      ? Math.floor((input.commonEquityTier1Cents / input.totalRiskExposureCents) * 10000)
      : 0;

  const liquidityCoverageRatioBps =
    input.netCashOutflows30DaysCents > 0
      ? Math.floor((input.highQualityLiquidAssetsCents / input.netCashOutflows30DaysCents) * 10000)
      : 0;

  const netStableFundingRatioBps =
    input.requiredStableFundingCents > 0
      ? Math.floor((input.availableStableFundingCents / input.requiredStableFundingCents) * 10000)
      : 0;

  if (cet1RatioBps < GATE_22_SCALE_TARGETS.BASEL_XII_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XII requirement of ${GATE_22_SCALE_TARGETS.BASEL_XII_MIN_CET1_BPS} bps (35.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_22_SCALE_TARGETS.BASEL_XII_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XII requirement of ${GATE_22_SCALE_TARGETS.BASEL_XII_MIN_LCR_BPS} bps (800.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_22_SCALE_TARGETS.BASEL_XII_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XII requirement of ${GATE_22_SCALE_TARGETS.BASEL_XII_MIN_NSFR_BPS} bps (300.00%)`
    );
  }

  const targetBufferCents = GATE_22_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $500.0B requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 2555) {
    violations.push(
      `Stress test survival ${input.stressTestSurvivalDays} days is below 2,555 days (7 years) requirement`
    );
  }

  const isSolvent = violations.length === 0;

  let solvencyStatus: BaselXiiSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (!isSolvent) {
    if (cet1RatioBps < GATE_22_SCALE_TARGETS.BASEL_XII_MIN_CET1_BPS) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_22_SCALE_TARGETS.BASEL_XII_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XII_AUDIT:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
