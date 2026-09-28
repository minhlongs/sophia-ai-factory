/**
 * @file basel-viii-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel VIII Extreme Solvency & $25.0B Sovereign Planetary Capital Buffer.
 */

import { createHash } from 'node:crypto';
import {
  GATE_18_SCALE_TARGETS,
  type BaselViiiSolvencyStatus,
  type GalacticCollateralAsset,
} from '@/seed/types/galactic-rtgs-capital';

export interface BaselViiiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselViiiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselViiiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const GALACTIC_COLLATERAL_HAIRCUTS: Record<GalacticCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.06,
  SSDR_BASKET: 1.12,
  TIER_1_EQUITIES: 1.25,
  GSC_CREDITS: 1.35,
  K3_ENERGY_CRYSTALS: 1.45,
};

/**
 * Calculates net haircut-adjusted collateral valuation for galactic multi-asset reserves.
 */
export function calculateGalacticCollateralValue(
  pledgedAmountCents: number,
  assetType: GalacticCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  const haircutFactor = GALACTIC_COLLATERAL_HAIRCUTS[assetType] || 1.5;
  const netValuationCents = Math.floor(pledgedAmountCents / haircutFactor);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel VIII standards.
 */
export function evaluateBaselViiiSolvency(
  input: BaselViiiSolvencyInput
): BaselViiiSolvencyOutput {
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

  if (cet1RatioBps < GATE_18_SCALE_TARGETS.BASEL_VIII_MIN_CET1_BPS) {
    violations.push(
      `CET1 ratio ${cet1RatioBps} bps breaches Basel VIII minimum ${GATE_18_SCALE_TARGETS.BASEL_VIII_MIN_CET1_BPS} bps (25.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_18_SCALE_TARGETS.BASEL_VIII_MIN_LCR_BPS) {
    violations.push(
      `LCR ${liquidityCoverageRatioBps} bps breaches Basel VIII minimum ${GATE_18_SCALE_TARGETS.BASEL_VIII_MIN_LCR_BPS} bps (400.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_18_SCALE_TARGETS.BASEL_VIII_MIN_NSFR_BPS) {
    violations.push(
      `NSFR ${netStableFundingRatioBps} bps breaches Basel VIII minimum ${GATE_18_SCALE_TARGETS.BASEL_VIII_MIN_NSFR_BPS} bps (180.00%)`
    );
  }

  const targetBufferCents = GATE_18_SCALE_TARGETS.SOVEREIGN_BUFFER_TARGET_USD * 100;
  if (input.totalLiquidityBufferCents < targetBufferCents) {
    violations.push(
      `Total liquidity buffer $${(input.totalLiquidityBufferCents / 100).toLocaleString()} below $25.0B requirement`
    );
  }

  if (input.stressTestSurvivalDays < 365) {
    violations.push(
      `Stress test survival duration ${input.stressTestSurvivalDays} days is below 365-day Basel VIII requirement`
    );
  }

  const isSolvent = violations.length === 0;
  let solvencyStatus: BaselViiiSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';

  if (!isSolvent) {
    if (
      cet1RatioBps < GATE_18_SCALE_TARGETS.BASEL_VIII_MIN_CET1_BPS ||
      input.totalLiquidityBufferCents < targetBufferCents
    ) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (
      liquidityCoverageRatioBps < GATE_18_SCALE_TARGETS.BASEL_VIII_MIN_LCR_BPS
    ) {
      solvencyStatus = 'LIQUIDITY_RUN_RISK';
    } else {
      solvencyStatus = 'REGULATORY_HALT';
    }
  }

  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_VIII:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.totalLiquidityBufferCents}:${isSolvent}:${solvencyStatus}`
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
