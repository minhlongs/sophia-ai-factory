/**
 * @file basel-ix-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel IX Trans-Universal Solvency & $50.0B Multi-Dimensional Capital Buffer.
 */

import { createHash } from 'node:crypto';
import {
  GATE_19_SCALE_TARGETS,
  type BaselIxSolvencyStatus,
  type MultidimensionalCollateralAsset,
} from '@/seed/types/omniverse-rtgs-capital';

export interface BaselIxSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselIxSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselIxSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const MULTIDIMENSIONAL_COLLATERAL_HAIRCUTS: Record<MultidimensionalCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.05,
  SSDR_BASKET: 1.10,
  TIER_1_EQUITIES: 1.20,
  OMNI_CREDITS: 1.30,
  PLANCK_ENERGY_SINGULARITIES: 1.40,
};

/**
 * Calculates net haircut-adjusted collateral valuation for multi-dimensional sovereign reserves.
 */
export function calculateMultidimensionalCollateralValue(
  pledgedAmountCents: number,
  assetType: MultidimensionalCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  const haircutFactor = MULTIDIMENSIONAL_COLLATERAL_HAIRCUTS[assetType] || 1.5;
  const netValuationCents = Math.floor(pledgedAmountCents / haircutFactor);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel IX standards.
 */
export function evaluateBaselIxSolvency(
  input: BaselIxSolvencyInput
): BaselIxSolvencyOutput {
  const violations: string[] = [];

  const cet1RatioBps =
    input.totalRiskExposureCents > 0
      ? Math.floor((input.commonEquityTier1Cents / input.totalRiskExposureCents) * 10000)
      : 0;

  const liquidityCoverageRatioBps =
    input.netCashOutflows30DaysCents > 0
      ? Math.floor(
          (input.highQualityLiquidAssetsCents / input.netCashOutflows30DaysCents) * 10000
        )
      : 0;

  const netStableFundingRatioBps =
    input.requiredStableFundingCents > 0
      ? Math.floor(
          (input.availableStableFundingCents / input.requiredStableFundingCents) * 10000
        )
      : 0;

  if (cet1RatioBps < GATE_19_SCALE_TARGETS.BASEL_IX_MIN_CET1_BPS) {
    violations.push(
      `CET1 ratio ${cet1RatioBps} bps breaches Basel IX minimum ${GATE_19_SCALE_TARGETS.BASEL_IX_MIN_CET1_BPS} bps (28.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_19_SCALE_TARGETS.BASEL_IX_MIN_LCR_BPS) {
    violations.push(
      `LCR ${liquidityCoverageRatioBps} bps breaches Basel IX minimum ${GATE_19_SCALE_TARGETS.BASEL_IX_MIN_LCR_BPS} bps (500.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_19_SCALE_TARGETS.BASEL_IX_MIN_NSFR_BPS) {
    violations.push(
      `NSFR ${netStableFundingRatioBps} bps breaches Basel IX minimum ${GATE_19_SCALE_TARGETS.BASEL_IX_MIN_NSFR_BPS} bps (200.00%)`
    );
  }

  const targetBufferCents = GATE_19_SCALE_TARGETS.SOVEREIGN_BUFFER_TARGET_USD * 100;
  if (input.totalLiquidityBufferCents < targetBufferCents) {
    violations.push(
      `Total liquidity buffer $${(input.totalLiquidityBufferCents / 100).toLocaleString()} below $50.0B requirement`
    );
  }

  if (input.stressTestSurvivalDays < 730) {
    violations.push(
      `Stress test survival duration ${input.stressTestSurvivalDays} days is below 730-day (2-year) Basel IX requirement`
    );
  }

  const isSolvent = violations.length === 0;
  let solvencyStatus: BaselIxSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';

  if (!isSolvent) {
    if (
      cet1RatioBps < GATE_19_SCALE_TARGETS.BASEL_IX_MIN_CET1_BPS ||
      input.totalLiquidityBufferCents < targetBufferCents
    ) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (
      liquidityCoverageRatioBps < GATE_19_SCALE_TARGETS.BASEL_IX_MIN_LCR_BPS
    ) {
      solvencyStatus = 'LIQUIDITY_RUN_RISK';
    } else {
      solvencyStatus = 'REGULATORY_HALT';
    }
  }

  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_IX:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.totalLiquidityBufferCents}:${isSolvent}:${solvencyStatus}`
    )
    .digest('hex');

  return {
    isSolvent,
    solvencyStatus,
    cet1RatioBps,
    liquidityCoverageRatioBps,
    netStableFundingRatioBps,
    totalLiquidityBufferCents: input.totalLiquidityBufferCents,
    stressTestSurvivalDays: input.stressTestSurvivalDays,
    violations,
    supervisorySignature,
  };
}
