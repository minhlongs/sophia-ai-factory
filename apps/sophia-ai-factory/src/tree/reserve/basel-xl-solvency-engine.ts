/**
 * @file basel-xl-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XL Centum-Quintillion Solvency & $1,000,000.0 Quadrillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  BASEL_XL_CONSTRAINTS,
  type BaselXlSolvencyStatus,
} from '@/seed/types/centumquintillion-trans-cosmic-hyper-rtgs-capital';
import {
  CENTUMQUINTILLION_COLLATERAL_HAIRCUTS,
  calculateCentumquintillionCollateralValue,
  type BaselXlSolvencyInput,
  type BaselXlSolvencyOutput,
  type CentumquintillionCollateralValuationResult,
} from './basel-xl-solvency-types';

export {
  CENTUMQUINTILLION_COLLATERAL_HAIRCUTS,
  calculateCentumquintillionCollateralValue,
};
export type {
  BaselXlSolvencyInput,
  BaselXlSolvencyOutput,
  CentumquintillionCollateralValuationResult,
};

/**
 * Evaluates capital adequacy, liquidity, and structural funding under Basel XL.
 */
export function evaluateBaselXlSolvency(
  input: BaselXlSolvencyInput
): BaselXlSolvencyOutput {
  const violations: string[] = [];

  const cet1RatioBps =
    input.totalRiskExposureCents > 0
      ? Math.floor((input.commonEquityTier1Cents / input.totalRiskExposureCents) * 10_000)
      : 10_000;

  if (cet1RatioBps < BASEL_XL_CONSTRAINTS.MIN_CET1_RATIO_BPS) {
    violations.push(
      `CET1 ratio ${cet1RatioBps} bps is below Basel XL threshold ${BASEL_XL_CONSTRAINTS.MIN_CET1_RATIO_BPS} bps`
    );
  }

  const liquidityCoverageRatioBps =
    input.netCashOutflows30DaysCents > 0
      ? Math.floor((input.highQualityLiquidAssetsCents / input.netCashOutflows30DaysCents) * 10_000)
      : 25_000_000;

  if (liquidityCoverageRatioBps < BASEL_XL_CONSTRAINTS.MIN_LIQUIDITY_COVERAGE_RATIO_BPS) {
    violations.push(
      `LCR ${liquidityCoverageRatioBps} bps is below Basel XL threshold ${BASEL_XL_CONSTRAINTS.MIN_LIQUIDITY_COVERAGE_RATIO_BPS} bps`
    );
  }

  const netStableFundingRatioBps =
    input.requiredStableFundingCents > 0
      ? Math.floor((input.availableStableFundingCents / input.requiredStableFundingCents) * 10_000)
      : 3_500_000;

  if (netStableFundingRatioBps < BASEL_XL_CONSTRAINTS.MIN_NET_STABLE_FUNDING_RATIO_BPS) {
    violations.push(
      `NSFR ${netStableFundingRatioBps} bps is below Basel XL threshold ${BASEL_XL_CONSTRAINTS.MIN_NET_STABLE_FUNDING_RATIO_BPS} bps`
    );
  }

  if (input.sovereignCapitalBufferCents < BASEL_XL_CONSTRAINTS.SOVEREIGN_CAPITAL_BUFFER_MIN_CENTS) {
    violations.push(
      `Sovereign buffer ${input.sovereignCapitalBufferCents} is below minimum requirement ${BASEL_XL_CONSTRAINTS.SOVEREIGN_CAPITAL_BUFFER_MIN_CENTS} cents`
    );
  }

  if (input.stressTestSurvivalDays < BASEL_XL_CONSTRAINTS.MIN_SURVIVAL_HORIZON_DAYS) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below required ${BASEL_XL_CONSTRAINTS.MIN_SURVIVAL_HORIZON_DAYS} days`
    );
  }

  let solvencyStatus: BaselXlSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (input.sovereignCapitalBufferCents < BASEL_XL_CONSTRAINTS.SOVEREIGN_CAPITAL_BUFFER_MIN_CENTS) {
    solvencyStatus = 'CAPITAL_BUFFER_BREACH';
  } else if (liquidityCoverageRatioBps < BASEL_XL_CONSTRAINTS.MIN_LIQUIDITY_COVERAGE_RATIO_BPS) {
    solvencyStatus = 'LIQUIDITY_RESTRICTED';
  } else if (violations.length > 0) {
    solvencyStatus = 'INSOLVENT_HALT';
  }

  const isSolvent = violations.length === 0;

  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XL_AUDIT:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}:${isSolvent}`
    )
    .digest('hex');

  return {
    isSolvent,
    cet1RatioBps,
    liquidityCoverageRatioBps,
    netStableFundingRatioBps,
    sovereignCapitalBufferCents: input.sovereignCapitalBufferCents,
    solvencyStatus,
    supervisorySignature,
    violations,
  };
}
