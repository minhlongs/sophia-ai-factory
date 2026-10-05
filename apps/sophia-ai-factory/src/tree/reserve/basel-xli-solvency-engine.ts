/**
 * @file basel-xli-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XLI Ducenti-Quinquaginta-Quintillion Solvency & $2,500,000.0 Quadrillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  calculateParameterizedCollateralValue,
  calculateBaselSolvencyRatios,
} from './basel-solvency-domain-engine';

import {
  BASEL_XLI_CONSTRAINTS,
  type BaselXliSolvencyStatus,
  type DucentiquinquagintaquintillionCollateralAssetType,
} from '@/seed/types/ducenti-quinquaginta-quintillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXliSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXliSolvencyOutput {
  isSolvent: boolean;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  solvencyStatus: BaselXliSolvencyStatus;
  supervisorySignature: string;
  violations: string[];
}

export interface DucentiquinquagintaquintillionCollateralValuationResult {
  assetType: DucentiquinquagintaquintillionCollateralAssetType;
  nominalValueCents: number;
  haircutMultiplier: number;
  netValuationCents: number;
}

/**
 * Haircut table for Ducenti-Quinquaginta-Quintillion high-tier sovereign collateral assets under Basel XLI.
 */
export const DUCENTIQUINQUAGINTAQUINTILLION_COLLATERAL_HAIRCUTS: Record<DucentiquinquagintaquintillionCollateralAssetType, number> = {
  SOVEREIGN_BONDS: 1.0,
  PHYSICAL_GOLD: 1.005,
  SSDR_V30_BASKET: 1.010,
  TIER_1_EQUITIES: 1.020,
  DUCENTIQUINQUAGINTAQUINTILLION_CREDITS: 1.025,
  DUCENTIQUINQUAGINTAQUINTILLION_SUB_PLANCK_FOAM: 1.030,
};

/**
 * Computes Basel XLI capital and liquidity ratios.
 */
export function calculateBaselXliSolvencyRatios(input: BaselXliSolvencyInput) {
  return calculateBaselSolvencyRatios(input);
}

/**
 * Evaluates whether an institution complies with Basel XLI requirements.
 */
export function evaluateBaselXliSolvencyCompliance(
  input: BaselXliSolvencyInput
): BaselXliSolvencyOutput {
  const violations: string[] = [];

  const cet1RatioBps =
    input.totalRiskExposureCents > 0
      ? Math.floor((input.commonEquityTier1Cents / input.totalRiskExposureCents) * 10_000)
      : 10_000;

  if (cet1RatioBps < BASEL_XLI_CONSTRAINTS.MIN_CET1_RATIO_BPS) {
    violations.push(
      `CET1 ratio ${cet1RatioBps} bps is below Basel XLI threshold ${BASEL_XLI_CONSTRAINTS.MIN_CET1_RATIO_BPS} bps`
    );
  }

  const liquidityCoverageRatioBps =
    input.netCashOutflows30DaysCents > 0
      ? Math.floor((input.highQualityLiquidAssetsCents / input.netCashOutflows30DaysCents) * 10_000)
      : 30_000_000;

  if (liquidityCoverageRatioBps < BASEL_XLI_CONSTRAINTS.MIN_LIQUIDITY_COVERAGE_RATIO_BPS) {
    violations.push(
      `LCR ${liquidityCoverageRatioBps} bps is below Basel XLI threshold ${BASEL_XLI_CONSTRAINTS.MIN_LIQUIDITY_COVERAGE_RATIO_BPS} bps`
    );
  }

  const netStableFundingRatioBps =
    input.requiredStableFundingCents > 0
      ? Math.floor((input.availableStableFundingCents / input.requiredStableFundingCents) * 10_000)
      : 4_000_000;

  if (netStableFundingRatioBps < BASEL_XLI_CONSTRAINTS.MIN_NET_STABLE_FUNDING_RATIO_BPS) {
    violations.push(
      `NSFR ${netStableFundingRatioBps} bps is below Basel XLI threshold ${BASEL_XLI_CONSTRAINTS.MIN_NET_STABLE_FUNDING_RATIO_BPS} bps`
    );
  }

  if (input.sovereignCapitalBufferCents < BASEL_XLI_CONSTRAINTS.SOVEREIGN_CAPITAL_BUFFER_MIN_CENTS) {
    violations.push(
      `Sovereign buffer ${input.sovereignCapitalBufferCents} is below minimum requirement ${BASEL_XLI_CONSTRAINTS.SOVEREIGN_CAPITAL_BUFFER_MIN_CENTS} cents`
    );
  }

  if (input.stressTestSurvivalDays < BASEL_XLI_CONSTRAINTS.MIN_SURVIVAL_HORIZON_DAYS) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below required ${BASEL_XLI_CONSTRAINTS.MIN_SURVIVAL_HORIZON_DAYS} days`
    );
  }

  let solvencyStatus: BaselXliSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (input.sovereignCapitalBufferCents < BASEL_XLI_CONSTRAINTS.SOVEREIGN_CAPITAL_BUFFER_MIN_CENTS) {
    solvencyStatus = 'CAPITAL_BUFFER_BREACH';
  } else if (liquidityCoverageRatioBps < BASEL_XLI_CONSTRAINTS.MIN_LIQUIDITY_COVERAGE_RATIO_BPS) {
    solvencyStatus = 'LIQUIDITY_RESTRICTED';
  } else if (violations.length > 0) {
    solvencyStatus = 'INSOLVENT_HALT';
  }

  const isSolvent = violations.length === 0;

  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XLI_AUDIT:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}:${isSolvent}`
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

/**
 * Valuates collateral assets with Basel XLI regulatory haircuts.
 */
export function valuateDucentiquinquagintaquintillionCollateral(
  first: DucentiquinquagintaquintillionCollateralAssetType | number,
  second: number | DucentiquinquagintaquintillionCollateralAssetType
): DucentiquinquagintaquintillionCollateralValuationResult {
  const assetType = typeof first === 'string' ? first : (second as DucentiquinquagintaquintillionCollateralAssetType);
  const nominalValueCents = typeof first === 'number' ? first : (second as number);
  const haircutMultiplier = DUCENTIQUINQUAGINTAQUINTILLION_COLLATERAL_HAIRCUTS[assetType] ?? 1.005;
  const netValuationCents = Math.round(nominalValueCents * haircutMultiplier);
  return {
    assetType,
    nominalValueCents,
    haircutMultiplier,
    netValuationCents,
  };
}
