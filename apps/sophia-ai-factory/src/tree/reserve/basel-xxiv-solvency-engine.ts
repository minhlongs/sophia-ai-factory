/**
 * @file basel-xxiv-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXIV Penta-Quadrillion Solvency & $5.0 Quadrillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  GATE_34_SCALE_TARGETS,
  type BaselXxivSolvencyStatus,
  type PentaquadrillionCollateralAsset,
} from '@/seed/types/pentaquadrillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXxivSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxivSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXxivSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const PENTAQUADRILLION_COLLATERAL_HAIRCUTS: Record<PentaquadrillionCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.04,
  SSDR_V16_BASKET: 1.07,
  TIER_1_EQUITIES: 1.12,
  PENTAQUADRILLION_CREDITS: 1.20,
  PENTAQUADRILLION_SUB_PLANCK_FOAM: 1.35,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Penta-Quadrillion sovereign reserves.
 */
export function calculatePentaquadrillionCollateralValue(
  pledgedAmountCents: number,
  assetType: PentaquadrillionCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  const haircutFactor = PENTAQUADRILLION_COLLATERAL_HAIRCUTS[assetType] || 1.45;
  const factorScaled = BigInt(Math.round(haircutFactor * 10000));
  const pledgedScaled = BigInt(Math.round(pledgedAmountCents)) * 10000n;
  const netValuationCents = Number(pledgedScaled / factorScaled);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXIV standards.
 */
export function evaluateBaselXxivSolvency(input: BaselXxivSolvencyInput): BaselXxivSolvencyOutput {
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

  if (cet1RatioBps < GATE_34_SCALE_TARGETS.BASEL_XXIV_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XXIV requirement of ${GATE_34_SCALE_TARGETS.BASEL_XXIV_MIN_CET1_BPS} bps (85.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_34_SCALE_TARGETS.BASEL_XXIV_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XXIV requirement of ${GATE_34_SCALE_TARGETS.BASEL_XXIV_MIN_LCR_BPS} bps (8000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_34_SCALE_TARGETS.BASEL_XXIV_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XXIV requirement of ${GATE_34_SCALE_TARGETS.BASEL_XXIV_MIN_NSFR_BPS} bps (2000.00%)`
    );
  }

  const targetBufferCents = GATE_34_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $5.0Q requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 1000000) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below 2,740-year requirement (1,000,000 days)`
    );
  }

  let solvencyStatus: BaselXxivSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_34_SCALE_TARGETS.BASEL_XXIV_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XXIV:${isSolvent}:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
