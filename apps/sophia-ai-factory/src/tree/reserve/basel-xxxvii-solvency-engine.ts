/**
 * @file basel-xxxvii-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXXVII Decem-Millia-Quadrillion Solvency & $100,000.0Q Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  GATE_47_SCALE_TARGETS,
  type BaselXxxviiSolvencyStatus,
  type DecemmilliaquadrillionCollateralAsset,
} from '@/seed/types/decemmilliaquadrillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXxxviiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxxviiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXxxviiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const DECEMMILLIAQUADRILLION_COLLATERAL_HAIRCUTS: Record<
  DecemmilliaquadrillionCollateralAsset,
  number
> = {
  SOVEREIGN_BONDS: 1.002,
  PHYSICAL_GOLD: 1.005,
  SSDR_V28_BASKET: 1.010,
  TIER_1_EQUITIES: 1.020,
  DECEMMILLIAQUADRILLION_CREDITS: 1.030,
  DECEMMILLIAQUADRILLION_SUB_PLANCK_FOAM: 1.050,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Decem-Millia-Quadrillion sovereign reserves with BigInt precision.
 */
export function calculateDecemmilliaquadrillionCollateralValue(
  pledgedAmountCents: number,
  assetType: DecemmilliaquadrillionCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  const haircutFactor = DECEMMILLIAQUADRILLION_COLLATERAL_HAIRCUTS[assetType] || 1.35;
  const factorScaled = BigInt(Math.round(haircutFactor * 10000));
  const pledgedScaled = BigInt(Math.round(pledgedAmountCents)) * 10000n;
  const netValuationCents = Number(pledgedScaled / factorScaled);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXXVII standards.
 */
export function evaluateBaselXxxviiSolvency(input: BaselXxxviiSolvencyInput): BaselXxxviiSolvencyOutput {
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

  if (cet1RatioBps < GATE_47_SCALE_TARGETS.BASEL_XXXVII_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XXXVII requirement of ${GATE_47_SCALE_TARGETS.BASEL_XXXVII_MIN_CET1_BPS} bps (99.95%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_47_SCALE_TARGETS.BASEL_XXXVII_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XXXVII requirement of ${GATE_47_SCALE_TARGETS.BASEL_XXXVII_MIN_LCR_BPS} bps (100000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_47_SCALE_TARGETS.BASEL_XXXVII_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XXXVII requirement of ${GATE_47_SCALE_TARGETS.BASEL_XXXVII_MIN_NSFR_BPS} bps (20000.00%)`
    );
  }

  const targetBufferCents = GATE_47_SCALE_TARGETS.SOVEREIGN_BUFFER_TARGET_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below required ${targetBufferCents} cents ($100,000.0Q)`
    );
  }

  if (input.stressTestSurvivalDays < 20_000_000) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below required 20,000,000 days (54,794 years)`
    );
  }

  let solvencyStatus: BaselXxxviiSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_47_SCALE_TARGETS.BASEL_XXXVII_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XXXVII_SOLVENCY_CERTIFICATE:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
