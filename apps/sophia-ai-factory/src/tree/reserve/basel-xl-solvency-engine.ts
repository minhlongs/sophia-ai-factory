/**
 * @file basel-xl-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XL Centum-Quintillion Solvency & $1,000,000.0 Quadrillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  calculateParameterizedCollateralValue,
} from './basel-solvency-domain-engine';

import {
  BASEL_XL_CONSTRAINTS,
  type BaselXlSolvencyStatus,
  type CentumquintillionCollateralAssetType,
} from '@/seed/types/centumquintillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXlSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXlSolvencyOutput {
  isSolvent: boolean;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  solvencyStatus: BaselXlSolvencyStatus;
  supervisorySignature: string;
  violations: string[];
}

export interface CentumquintillionCollateralValuationResult {
  assetType: CentumquintillionCollateralAssetType;
  nominalValueCents: number;
  haircutMultiplier: number;
  netValuationCents: number;
}

/**
 * Haircut table for Centum-Quintillion high-tier sovereign collateral assets under Basel XL.
 */
export const CENTUMQUINTILLION_COLLATERAL_HAIRCUTS: Record<CentumquintillionCollateralAssetType, number> = {
  SOVEREIGN_BONDS: 1.0,
  PHYSICAL_GOLD: 1.005,
  SSDR_V30_BASKET: 1.010,
  TIER_1_EQUITIES: 1.020,
  CENTUMQUINTILLION_CREDITS: 1.025,
  CENTUMQUINTILLION_SUB_PLANCK_FOAM: 1.030,
};

/**
 * Calculates net haircut-adjusted collateral value.
 */
export function calculateCentumquintillionCollateralValue(
  nominalValueCents: number,
  assetType: CentumquintillionCollateralAssetType
): CentumquintillionCollateralValuationResult {
  return calculateParameterizedCollateralValue(
    nominalValueCents,
    assetType,
    CENTUMQUINTILLION_COLLATERAL_HAIRCUTS,
    1.05
  ) as unknown as CentumquintillionCollateralValuationResult;
}

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
