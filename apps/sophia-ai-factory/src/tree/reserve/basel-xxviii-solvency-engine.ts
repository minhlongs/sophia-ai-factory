/**
 * @file basel-xxviii-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXVIII Centum-Quadrillion Solvency & $100.0 Quadrillion Sovereign Reserve Singularity.
 */

import { createHash } from 'node:crypto';
import {
  calculateParameterizedCollateralValue,
  calculateBaselSolvencyRatios,
} from './basel-solvency-domain-engine';

import {
  GATE_38_SCALE_TARGETS,
  type BaselXxviiiSolvencyStatus,
  type CentumquadrillionCollateralAsset,
} from '@/seed/types/centumquadrillion-trans-cosmic-hyper-rtgs-capital';

export interface BaselXxviiiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxviiiSolvencyOutput {
  isSolvent: boolean;
  solvencyStatus: BaselXxviiiSolvencyStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
}

export const CENTUMQUADRILLION_COLLATERAL_HAIRCUTS: Record<CentumquadrillionCollateralAsset, number> = {
  SOVEREIGN_BONDS: 1.02,
  PHYSICAL_GOLD: 1.025,
  SSDR_V20_BASKET: 1.05,
  TIER_1_EQUITIES: 1.08,
  CENTUMQUADRILLION_CREDITS: 1.15,
  CENTUMQUADRILLION_SUB_PLANCK_FOAM: 1.25,
};

/**
 * Calculates net haircut-adjusted collateral valuation for Centum-Quadrillion sovereign reserves with BigInt precision.
 */
export function calculateCentumquadrillionCollateralValue(
  pledgedAmountCents: number,
  assetType: CentumquadrillionCollateralAsset
): { netValuationCents: number; haircutFactor: number } {
  return calculateParameterizedCollateralValue(
    pledgedAmountCents,
    assetType,
    CENTUMQUADRILLION_COLLATERAL_HAIRCUTS,
    1.45
  );
}

/**
 * Evaluates extreme capital adequacy and solvency under Basel XXVIII standards.
 */
export function evaluateBaselXxviiiSolvency(input: BaselXxviiiSolvencyInput): BaselXxviiiSolvencyOutput {
  const violations: string[] = [];

  const { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps } =
    calculateBaselSolvencyRatios(input);

  if (cet1RatioBps < GATE_38_SCALE_TARGETS.BASEL_XXVIII_MIN_CET1_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below Basel XXVIII requirement of ${GATE_38_SCALE_TARGETS.BASEL_XXVIII_MIN_CET1_BPS} bps (97.00%)`
    );
  }

  if (liquidityCoverageRatioBps < GATE_38_SCALE_TARGETS.BASEL_XXVIII_MIN_LCR_BPS) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below Basel XXVIII requirement of ${GATE_38_SCALE_TARGETS.BASEL_XXVIII_MIN_LCR_BPS} bps (18000.00%)`
    );
  }

  if (netStableFundingRatioBps < GATE_38_SCALE_TARGETS.BASEL_XXVIII_MIN_NSFR_BPS) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below Basel XXVIII requirement of ${GATE_38_SCALE_TARGETS.BASEL_XXVIII_MIN_NSFR_BPS} bps (4000.00%)`
    );
  }

  const targetBufferCents = GATE_38_SCALE_TARGETS.SOVEREIGN_RESERVE_SINGULARITY_USD * 100;
  if (input.sovereignCapitalBufferCents < targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below $100.0Q requirement (${targetBufferCents} cents)`
    );
  }

  if (input.stressTestSurvivalDays < 3000000) {
    violations.push(
      `Stress test survival horizon ${input.stressTestSurvivalDays} days is below 8,219-year requirement (3,000,000 days)`
    );
  }

  let solvencyStatus: BaselXxviiiSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < GATE_38_SCALE_TARGETS.BASEL_XXVIII_MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XXVIII:${isSolvent}:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
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
