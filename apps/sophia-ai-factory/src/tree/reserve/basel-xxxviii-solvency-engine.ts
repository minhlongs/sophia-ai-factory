/**
 * @file basel-xxxviii-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXXVIII Viginti-Quinque-Millia-Quadrillion Solvency & $250,000.0Q Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  GATE_48_SCALE_TARGETS,
  type BaselXxxviiiSolvencyStatus,
  type VigintiquinquemilliaquadrillionCollateralAsset,
} from '@/seed/types/vigintiquinquemilliaquadrillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXxxviiiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxxviiiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXxxviiiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const VIGINTIQUINQUEMILLIAQUADRILLION_COLLATERAL_HAIRCUTS: Record<
  VigintiquinquemilliaquadrillionCollateralAsset,
  number
> = {
  SOVEREIGN_BONDS: 1.001,
  PHYSICAL_GOLD: 1.003,
  SSDR_V28_BASKET: 1.008,
  TIER_1_EQUITIES: 1.015,
  VIGINTIQUINQUEMILLIAQUADRILLION_CREDITS: 1.025,
  VIGINTIQUINQUEMILLIAQUADRILLION_SUB_PLANCK_FOAM: 1.040,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Viginti-Quinque-Millia-Quadrillion sovereign reserves with BigInt precision.
 */
export function calculateVigintiquinquemilliaquadrillionCollateralValue(
  pledgedAmountCents: number,
  assetType: VigintiquinquemilliaquadrillionCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  const haircutFactor = VIGINTIQUINQUEMILLIAQUADRILLION_COLLATERAL_HAIRCUTS[assetType] || 1.35;
  const factorScaled = BigInt(Math.round(haircutFactor * 10000));
  const pledgedScaled = BigInt(Math.round(pledgedAmountCents)) * 10000n;
  const netValuationCents = Number(pledgedScaled / factorScaled);
  return { netValuationCents, haircutFactor };
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXXVIII standards.
 */
export function evaluateBaselXxxviiiSolvency(input: BaselXxxviiiSolvencyInput): BaselXxxviiiSolvencyOutput {
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

  if (cet1RatioBps < GATE_48_SCALE_TARGETS.BASEL_XXXVIII_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XXXVIII requirement of ${GATE_48_SCALE_TARGETS.BASEL_XXXVIII_MIN_CET1_BPS} bps (99.98%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_48_SCALE_TARGETS.BASEL_XXXVIII_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XXXVIII requirement of ${GATE_48_SCALE_TARGETS.BASEL_XXXVIII_MIN_LCR_BPS} bps (150000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_48_SCALE_TARGETS.BASEL_XXXVIII_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XXXVIII requirement of ${GATE_48_SCALE_TARGETS.BASEL_XXXVIII_MIN_NSFR_BPS} bps (25000.00%)`
    );
  }

  const targetBufferCents = GATE_48_SCALE_TARGETS.SOVEREIGN_BUFFER_TARGET_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below required ${targetBufferCents} cents ($250,000.0Q)`
    );
  }

  if (input.stressTestSurvivalDays < 25_000_000) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below required 25,000,000 days (68,493 years)`
    );
  }

  let solvencyStatus: BaselXxxviiiSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_48_SCALE_TARGETS.BASEL_XXXVIII_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XXXVIII_SOLVENCY_CERTIFICATE:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
