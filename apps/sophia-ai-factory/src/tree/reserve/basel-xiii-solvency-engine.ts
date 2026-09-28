/**
 * @file basel-xiii-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XIII Trans-Cosmic Solvency & $1.0 Trillion Multiverse Treasury Singularity.
 */

import { createHash } from 'node:crypto';
import {
  GATE_23_SCALE_TARGETS,
  type BaselXiiiSolvencyStatus,
  type TransCosmicCollateralAsset,
} from '@/seed/types/trans-cosmic-hyper-rtgs-capital';

export interface BaselXiiiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXiiiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXiiiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const TRANS_COSMIC_COLLATERAL_HAIRCUTS: Record<TransCosmicCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.05,
  SSDR_V5_BASKET: 1.08,
  TIER_1_EQUITIES: 1.15,
  MULTIVERSE_CREDITS: 1.25,
  ZERO_POINT_VACUUM_SINGULARITIES: 1.35,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Trans-Cosmic sovereign reserves.
 */
export function calculateTransCosmicCollateralValue(
  pledgedAmountCents: number,
  assetType: TransCosmicCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  const haircutFactor = TRANS_COSMIC_COLLATERAL_HAIRCUTS[assetType] || 1.45;
  const netValuationCents = Math.floor(pledgedAmountCents / haircutFactor);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XIII standards.
 */
export function evaluateBaselXiiiSolvency(input: BaselXiiiSolvencyInput): BaselXiiiSolvencyOutput {
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

  if (cet1RatioBps < GATE_23_SCALE_TARGETS.BASEL_XIII_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XIII requirement of ${GATE_23_SCALE_TARGETS.BASEL_XIII_MIN_CET1_BPS} bps (38.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_23_SCALE_TARGETS.BASEL_XIII_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XIII requirement of ${GATE_23_SCALE_TARGETS.BASEL_XIII_MIN_LCR_BPS} bps (900.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_23_SCALE_TARGETS.BASEL_XIII_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XIII requirement of ${GATE_23_SCALE_TARGETS.BASEL_XIII_MIN_NSFR_BPS} bps (350.00%)`
    );
  }

  const targetBufferCents = GATE_23_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $1.0T requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 3650) {
    violations.push(
      `Stress test survival ${input.stressTestSurvivalDays} days is below 3,650 days (10 years) requirement`
    );
  }

  const isSolvent = violations.length === 0;

  let solvencyStatus: BaselXiiiSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (!isSolvent) {
    if (cet1RatioBps < GATE_23_SCALE_TARGETS.BASEL_XIII_MIN_CET1_BPS) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_23_SCALE_TARGETS.BASEL_XIII_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XIII_AUDIT:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
