/**
 * @file basel-v-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel V Solvency, Capital Adequacy & $2.5B Sovereign Reserves.
 */

import { createHash } from 'node:crypto';
import {
  calculateParameterizedCollateralValue,
  calculateBaselSolvencyRatios,
} from './basel-solvency-domain-engine';

import {
  GATE_15_SCALE_TARGETS,
  type OmniversalCollateralAsset,
} from '@/seed/types/omniversal-clearing';

export interface BaselVSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselVSolvencyOutput {
  isSolvent: boolean;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const OMNIVERSAL_COLLATERAL_HAIRCUTS: Record<OmniversalCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.05,
  PHYSICAL_GOLD: 1.15,
  SSDR_BASKET: 1.25,
  TIER_1_EQUITIES: 1.50,
  GEAC_COMPUTE_CREDITS: 1.75,
};

/**
 * Calculates net haircut-adjusted collateral valuation for multi-asset reserves.
 */
export function calculateOmniversalCollateralValue(
  pledgedAmountCents: number,
  assetType: OmniversalCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    OMNIVERSAL_COLLATERAL_HAIRCUTS,
    1.5
  );
}

/**
 * Evaluates global capital adequacy and liquidity compliance under Basel V rules.
 */
export function evaluateBaselVSolvency(input: BaselVSolvencyInput): BaselVSolvencyOutput {
  const violations: string[] = [];

  const { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps } =
    calculateBaselSolvencyRatios(input);

  if (cet1RatioBps < GATE_15_SCALE_TARGETS.BASEL_V_MIN_CET1_BPS) {
    violations.push(
      `CET1 ratio ${cet1RatioBps} bps breaches Basel V minimum ${GATE_15_SCALE_TARGETS.BASEL_V_MIN_CET1_BPS} bps (18.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_15_SCALE_TARGETS.BASEL_V_MIN_LCR_BPS) {
    violations.push(
      `LCR ${liquidityCoverageRatioBps} bps breaches Basel V minimum ${GATE_15_SCALE_TARGETS.BASEL_V_MIN_LCR_BPS} bps (250.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_15_SCALE_TARGETS.BASEL_V_MIN_NSFR_BPS) {
    violations.push(
      `NSFR ${netStableFundingRatioBps} bps breaches Basel V minimum ${GATE_15_SCALE_TARGETS.BASEL_V_MIN_NSFR_BPS} bps (135.00%)`
    );
  }

  const targetBufferCents = GATE_15_SCALE_TARGETS.SOVEREIGN_BUFFER_TARGET_USD * 100;
  if (input.totalLiquidityBufferCents < targetBufferCents) {
    violations.push(
      `Total liquidity buffer $${(input.totalLiquidityBufferCents / 100).toLocaleString()} below $2.5B requirement`
    );
  }

  if (input.stressTestSurvivalDays < 90) {
    violations.push(
      `Stress test survival duration ${input.stressTestSurvivalDays} days is below 90-day sovereign requirement`
    );
  }

  const isSolvent = violations.length === 0;

  const supervisorySignature = createHash('sha256')
    .update(`BASEL_V:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.totalLiquidityBufferCents}:${isSolvent}`)
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
