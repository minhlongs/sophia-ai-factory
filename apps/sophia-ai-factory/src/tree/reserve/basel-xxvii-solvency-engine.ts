/**
 * @file basel-xxvii-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXVII Quinquaginti-Quadrillion Solvency & $50.0 Quadrillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  GATE_37_SCALE_TARGETS,
  type BaselXxviiSolvencyStatus,
  type QuinquagintiquadrillionCollateralAsset,
} from '@/seed/types/quinquagintiquadrillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXxviiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxviiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXxviiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const QUINQUAGINTIQUADRILLION_COLLATERAL_HAIRCUTS: Record<QuinquagintiquadrillionCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.025,
  SSDR_V19_BASKET: 1.05,
  TIER_1_EQUITIES: 1.08,
  QUINQUAGINTIQUADRILLION_CREDITS: 1.15,
  QUINQUAGINTIQUADRILLION_SUB_PLANCK_FOAM: 1.25,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Quinquaginti-Quadrillion sovereign reserves with BigInt precision.
 */
export function calculateQuinquagintiquadrillionCollateralValue(
  pledgedAmountCents: number,
  assetType: QuinquagintiquadrillionCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  const haircutFactor = QUINQUAGINTIQUADRILLION_COLLATERAL_HAIRCUTS[assetType] || 1.45;
  const factorScaled = BigInt(Math.round(haircutFactor * 10000));
  const pledgedScaled = BigInt(Math.round(pledgedAmountCents)) * 10000n;
  const netValuationCents = Number(pledgedScaled / factorScaled);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXVII standards.
 */
export function evaluateBaselXxviiSolvency(input: BaselXxviiSolvencyInput): BaselXxviiSolvencyOutput {
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

  if (cet1RatioBps < GATE_37_SCALE_TARGETS.BASEL_XXVII_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XXVII requirement of ${GATE_37_SCALE_TARGETS.BASEL_XXVII_MIN_CET1_BPS} bps (95.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_37_SCALE_TARGETS.BASEL_XXVII_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XXVII requirement of ${GATE_37_SCALE_TARGETS.BASEL_XXVII_MIN_LCR_BPS} bps (15000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_37_SCALE_TARGETS.BASEL_XXVII_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XXVII requirement of ${GATE_37_SCALE_TARGETS.BASEL_XXVII_MIN_NSFR_BPS} bps (3500.00%)`
    );
  }

  const targetBufferCents = GATE_37_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $50.0Q requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 2500000) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below 6,849-year requirement (2,500,000 days)`
    );
  }

  let solvencyStatus: BaselXxviiSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_37_SCALE_TARGETS.BASEL_XXVII_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XXVII:${isSolvent}:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
