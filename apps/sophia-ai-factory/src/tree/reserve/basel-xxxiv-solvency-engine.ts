/**
 * @file basel-xxxiv-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXXIV Millia-Quadrillion Solvency & $10,000.0 Quadrillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  GATE_44_SCALE_TARGETS,
  type BaselXxxivSolvencyStatus,
  type MilliaquadrillionCollateralAsset,
} from '@/seed/types/milliaquadrillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXxxivSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxxivSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXxxivSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const MILLIAQUADRILLION_COLLATERAL_HAIRCUTS: Record<MilliaquadrillionCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.008,
  PHYSICAL_GOLD: 1.012,
  SSDR_V26_BASKET: 1.020,
  TIER_1_EQUITIES: 1.04,
  MILLIAQUADRILLION_CREDITS: 1.06,
  MILLIAQUADRILLION_SUB_PLANCK_FOAM: 1.10,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Millia-Quadrillion sovereign reserves with BigInt precision.
 */
export function calculateMilliaquadrillionCollateralValue(
  pledgedAmountCents: number,
  assetType: MilliaquadrillionCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  const haircutFactor = MILLIAQUADRILLION_COLLATERAL_HAIRCUTS[assetType] || 1.35;
  const factorScaled = BigInt(Math.round(haircutFactor * 10000));
  const pledgedScaled = BigInt(Math.round(pledgedAmountCents)) * 10000n;
  const netValuationCents = Number(pledgedScaled / factorScaled);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXXIV standards.
 */
export function evaluateBaselXxxivSolvency(input: BaselXxxivSolvencyInput): BaselXxxivSolvencyOutput {
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

  if (cet1RatioBps < GATE_44_SCALE_TARGETS.BASEL_XXXIV_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XXXIV requirement of ${GATE_44_SCALE_TARGETS.BASEL_XXXIV_MIN_CET1_BPS} bps (99.80%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_44_SCALE_TARGETS.BASEL_XXXIV_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XXXIV requirement of ${GATE_44_SCALE_TARGETS.BASEL_XXXIV_MIN_LCR_BPS} bps (50000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_44_SCALE_TARGETS.BASEL_XXXIV_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XXXIV requirement of ${GATE_44_SCALE_TARGETS.BASEL_XXXIV_MIN_NSFR_BPS} bps (10000.00%)`
    );
  }

  const targetBufferCents = GATE_44_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $10,000.0Q requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 10000000) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below 27,397-year requirement (10,000,000 days)`
    );
  }

  let solvencyStatus: BaselXxxivSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_44_SCALE_TARGETS.BASEL_XXXIV_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XXXIV:${isSolvent}:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
