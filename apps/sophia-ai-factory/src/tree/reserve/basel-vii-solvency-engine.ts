/**
 * @file basel-vii-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel VII Extreme Solvency & $10.0B Interstellar Capital Buffer.
 */

import { createHash } from 'node:crypto';
import {
  calculateParameterizedCollateralValue,
  calculateBaselSolvencyRatios,
} from './basel-solvency-domain-engine';

import {
  GATE_17_SCALE_TARGETS,
  type BaselViiSolvencyStatus,
  type InterstellarCollateralAsset,
} from '@/seed/types/hyper-rtgs-capital';

export interface BaselViiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselViiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselViiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const INTERSTELLAR_COLLATERAL_HAIRCUTS: Record<InterstellarCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.08,
  SSDR_BASKET: 1.15,
  TIER_1_EQUITIES: 1.30,
  KSCE_CREDITS: 1.45,
  ISCE_TACHYON: 1.55,
};

/**
 * Calculates net haircut-adjusted collateral valuation for interstellar multi-asset reserves.
 */
export function calculateInterstellarCollateralValue(
  pledgedAmountCents: number,
  assetType: InterstellarCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    INTERSTELLAR_COLLATERAL_HAIRCUTS,
    1.5
  );
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel VII standards.
 */
export function evaluateBaselViiSolvency(
  input: BaselViiSolvencyInput
): BaselViiSolvencyOutput {
  const violations: string[] = [];

  const { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps } =
    calculateBaselSolvencyRatios(input);

  if (cet1RatioBps < GATE_17_SCALE_TARGETS.BASEL_VII_MIN_CET1_BPS) {
    violations.push(
      `CET1 ratio ${cet1RatioBps} bps breaches Basel VII minimum ${GATE_17_SCALE_TARGETS.BASEL_VII_MIN_CET1_BPS} bps (22.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_17_SCALE_TARGETS.BASEL_VII_MIN_LCR_BPS) {
    violations.push(
      `LCR ${liquidityCoverageRatioBps} bps breaches Basel VII minimum ${GATE_17_SCALE_TARGETS.BASEL_VII_MIN_LCR_BPS} bps (350.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_17_SCALE_TARGETS.BASEL_VII_MIN_NSFR_BPS) {
    violations.push(
      `NSFR ${netStableFundingRatioBps} bps breaches Basel VII minimum ${GATE_17_SCALE_TARGETS.BASEL_VII_MIN_NSFR_BPS} bps (160.00%)`
    );
  }

  const targetBufferCents = GATE_17_SCALE_TARGETS.SOVEREIGN_BUFFER_TARGET_USD * 100;
  if (input.totalLiquidityBufferCents < targetBufferCents) {
    violations.push(
      `Total liquidity buffer $${(input.totalLiquidityBufferCents / 100).toLocaleString()} below $10.0B requirement`
    );
  }

  if (input.stressTestSurvivalDays < 180) {
    violations.push(
      `Stress test survival duration ${input.stressTestSurvivalDays} days is below 180-day Basel VII requirement`
    );
  }

  const isSolvent = violations.length === 0;
  let solvencyStatus: BaselViiSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';

  if (!isSolvent) {
    if (
      cet1RatioBps < GATE_17_SCALE_TARGETS.BASEL_VII_MIN_CET1_BPS ||
      input.totalLiquidityBufferCents < targetBufferCents
    ) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (
      liquidityCoverageRatioBps < GATE_17_SCALE_TARGETS.BASEL_VII_MIN_LCR_BPS
    ) {
      solvencyStatus = 'LIQUIDITY_RUN_RISK';
    } else {
      solvencyStatus = 'REGULATORY_HALT';
    }
  }

  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_VII:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.totalLiquidityBufferCents}:${isSolvent}:${solvencyStatus}`
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
