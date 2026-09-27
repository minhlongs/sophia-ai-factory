/**
 * @file basel-vi-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel VI Extreme Solvency & $5.0B Universal Capital Buffer.
 */

import { createHash } from 'node:crypto';
import {
  GATE_16_SCALE_TARGETS,
  type UniversalCollateralAsset,
} from '@/seed/types/super-rtgs-capital';

export interface BaselViSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselViSolvencyOutput {
  isSolvent: boolean;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const UNIVERSAL_COLLATERAL_HAIRCUTS: Record<UniversalCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.03,
  PHYSICAL_GOLD: 1.10,
  SSDR_BASKET: 1.20,
  TIER_1_EQUITIES: 1.40,
  KSCE_STELLAR_CREDITS: 1.60,
};

/**
 * Calculates net haircut-adjusted collateral valuation for universal multi-asset reserves.
 */
export function calculateUniversalCollateralValue(
  pledgedAmountCents: number,
  assetType: UniversalCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  const haircutFactor = UNIVERSAL_COLLATERAL_HAIRCUTS[assetType] || 1.5;
  const netValuationCents = Math.floor(pledgedAmountCents / haircutFactor);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel VI standards.
 */
export function evaluateBaselViSolvency(input: BaselViSolvencyInput): BaselViSolvencyOutput {
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

  if (cet1RatioBps < GATE_16_SCALE_TARGETS.BASEL_VI_MIN_CET1_BPS) {
    violations.push(
      `CET1 ratio ${cet1RatioBps} bps breaches Basel VI minimum ${GATE_16_SCALE_TARGETS.BASEL_VI_MIN_CET1_BPS} bps (20.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_16_SCALE_TARGETS.BASEL_VI_MIN_LCR_BPS) {
    violations.push(
      `LCR ${liquidityCoverageRatioBps} bps breaches Basel VI minimum ${GATE_16_SCALE_TARGETS.BASEL_VI_MIN_LCR_BPS} bps (300.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_16_SCALE_TARGETS.BASEL_VI_MIN_NSFR_BPS) {
    violations.push(
      `NSFR ${netStableFundingRatioBps} bps breaches Basel VI minimum ${GATE_16_SCALE_TARGETS.BASEL_VI_MIN_NSFR_BPS} bps (150.00%)`
    );
  }

  const targetBufferCents = GATE_16_SCALE_TARGETS.SOVEREIGN_BUFFER_TARGET_USD * 100;
  if (input.totalLiquidityBufferCents < targetBufferCents) {
    violations.push(
      `Total liquidity buffer $${(input.totalLiquidityBufferCents / 100).toLocaleString()} below $5.0B requirement`
    );
  }

  if (input.stressTestSurvivalDays < 120) {
    violations.push(
      `Stress test survival duration ${input.stressTestSurvivalDays} days is below 120-day Basel VI requirement`
    );
  }

  const isSolvent = violations.length === 0;

  const supervisorySignature = createHash('sha256')
    .update(`BASEL_VI:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.totalLiquidityBufferCents}:${isSolvent}`)
    .digest('hex');

  return {
    isSolvent,
    cet1RatioBps,
    liquidityCoverageRatioBps,
    netStableFundingRatioBps,
    totalLiquidityBufferCents: input.totalLiquidityBufferCents,
    stressTestSurvivalDays: input.stressTestSurvivalDays,
    violations,
    supervisorySignature,
  };
}
