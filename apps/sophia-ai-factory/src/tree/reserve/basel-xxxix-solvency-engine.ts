/**
 * @file basel-xxxix-solvency-engine.ts
 * @layer tree/reserve
 * @description Pure domain engine for Basel XXXIX Solvency & $500,000.0Q Sovereign Capital Buffer Singularity.
 */

import { createHash } from 'node:crypto';
import { calculateBaselSolvencyRatios } from './basel-solvency-domain-engine';
import {
  BASEL_XXXIX_CONSTRAINTS,
  type BaselXxxixSolvencyStatus,
} from '@/seed/types/quinquagintamilliaquadrillion-trans-cosmic-hyper-rtgs-capital';

export {
  calculateQuinquagintamilliaquadrillionCollateralValue,
  type QuinquagintamilliaquadrillionCollateralValuationResult,
} from './basel-xxxix-collateral-valuation';

export interface BaselXxxixSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXxxixSolvencyOutput {
  isSolvent: boolean;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  solvencyStatus: BaselXxxixSolvencyStatus;
  supervisorySignature: string;
  violations: string[];
}

/**
 * Evaluates full Basel XXXIX Solvency compliance across all balance sheet dimensions.
 */
export function evaluateBaselXxxixSolvency(
  input: BaselXxxixSolvencyInput
): BaselXxxixSolvencyOutput {
  const violations: string[] = [];

  const { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps } =
    calculateBaselSolvencyRatios(input, {
      defaultCet1RatioBps: 10000,
      defaultLcrBps: 20000000,
      defaultNsfrBps: 3000000,
    });

  if (cet1RatioBps < BASEL_XXXIX_CONSTRAINTS.MIN_CET1_RATIO_BPS) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below required ${BASEL_XXXIX_CONSTRAINTS.MIN_CET1_RATIO_BPS} bps`
    );
  }

  if (liquidityCoverageRatioBps < BASEL_XXXIX_CONSTRAINTS.MIN_LCR_BPS) {
    violations.push(
      `LCR ${liquidityCoverageRatioBps} bps is below required ${BASEL_XXXIX_CONSTRAINTS.MIN_LCR_BPS} bps`
    );
  }

  if (netStableFundingRatioBps < BASEL_XXXIX_CONSTRAINTS.MIN_NSFR_BPS) {
    violations.push(
      `NSFR ${netStableFundingRatioBps} bps is below required ${BASEL_XXXIX_CONSTRAINTS.MIN_NSFR_BPS} bps`
    );
  }

  if (
    input.sovereignCapitalBufferCents <
    BASEL_XXXIX_CONSTRAINTS.MIN_SOVEREIGN_CAPITAL_BUFFER_CENTS
  ) {
    violations.push(
      `Sovereign Capital Buffer ${input.sovereignCapitalBufferCents} cents is below mandatory $500,000.0Q threshold`
    );
  }

  if (input.stressTestSurvivalDays < BASEL_XXXIX_CONSTRAINTS.MIN_STRESS_SURVIVAL_DAYS) {
    violations.push(
      `Stress Test Horizon ${input.stressTestSurvivalDays} days is below required 30,000,000 days (82,191 years)`
    );
  }

  let solvencyStatus: BaselXxxixSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';
  if (violations.length > 0) {
    if (
      input.sovereignCapitalBufferCents <
      BASEL_XXXIX_CONSTRAINTS.MIN_SOVEREIGN_CAPITAL_BUFFER_CENTS
    ) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < BASEL_XXXIX_CONSTRAINTS.MIN_LCR_BPS) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT';
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION';
    }
  }

  const supervisorySignature = createHash('sha256')
    .update(
      `BASEL_XXXIX:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`
    )
    .digest('hex');

  return {
    isSolvent: violations.length === 0,
    cet1RatioBps,
    liquidityCoverageRatioBps,
    netStableFundingRatioBps,
    sovereignCapitalBufferCents: input.sovereignCapitalBufferCents,
    solvencyStatus,
    supervisorySignature,
    violations,
  };
}
