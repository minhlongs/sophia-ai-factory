/**
 * @file basel-x-to-xvii-solvency-helper.ts
 * @layer tree/reserve
 * @description Shared parameterized solvency evaluator for Basel X–XVII engines.
 */

import { createHash } from 'node:crypto';
import { calculateBaselSolvencyRatios } from './basel-solvency-domain-engine';

export interface BaselXToXviiSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface BaselXToXviiTierConfig {
  tierLabel: string;
  auditPrefix: string;
  minCet1Bps: number;
  cet1PctLabel: string;
  minLcrBps: number;
  lcrPctLabel: string;
  minNsfrBps: number;
  nsfrPctLabel: string;
  targetBufferCents: number;
  bufferLabel: string;
  minSurvivalDays: number;
  survivalLabel: string;
}

export function evaluateBaselXToXviiSolvency<TStatus extends string>(
  input: BaselXToXviiSolvencyInput,
  config: BaselXToXviiTierConfig,
): {
  isSolvent: boolean;
  solvencyStatus: TStatus;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
  violations: string[];
  supervisorySignature: string;
} {
  const violations: string[] = [];

  const { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps } =
    calculateBaselSolvencyRatios(input);

  if (cet1RatioBps < config.minCet1Bps) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below ${config.tierLabel} requirement of ${config.minCet1Bps} bps (${config.cet1PctLabel})`,
    );
  }

  if (liquidityCoverageRatioBps < config.minLcrBps) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below ${config.tierLabel} requirement of ${config.minLcrBps} bps (${config.lcrPctLabel})`,
    );
  }

  if (netStableFundingRatioBps < config.minNsfrBps) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below ${config.tierLabel} requirement of ${config.minNsfrBps} bps (${config.nsfrPctLabel})`,
    );
  }

  if (input.sovereignCapitalBufferCents < config.targetBufferCents) {
    violations.push(
      `Sovereign capital buffer ${input.sovereignCapitalBufferCents} cents is below ${config.bufferLabel} requirement (${config.targetBufferCents} cents)`,
    );
  }

  if (input.stressTestSurvivalDays < config.minSurvivalDays) {
    violations.push(
      `Stress test survival ${input.stressTestSurvivalDays} days is below ${config.survivalLabel} requirement`,
    );
  }

  const isSolvent = violations.length === 0;

  let solvencyStatus = 'SOLVENT_AND_CAPITALIZED' as TStatus;
  if (!isSolvent) {
    if (cet1RatioBps < config.minCet1Bps) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH' as TStatus;
    } else if (liquidityCoverageRatioBps < config.minLcrBps) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT' as TStatus;
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION' as TStatus;
    }
  }

  const supervisorySignature = createHash('sha256')
    .update(
      `${config.auditPrefix}:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.sovereignCapitalBufferCents}:${input.stressTestSurvivalDays}`,
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
