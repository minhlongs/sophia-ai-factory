/**
 * @file basel-tiered-solvency-evaluator.ts
 * @layer tree/reserve
 * @description Shared parameterized evaluator for Basel VII / VIII / IX solvency standards.
 */

import { createHash } from 'node:crypto';
import { calculateBaselSolvencyRatios } from './basel-solvency-domain-engine';

export interface BaselTieredSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  totalLiquidityBufferCents: number;
  stressTestSurvivalDays: number;
}

export type BaselTieredSolvencyStatus =
  | 'SOLVENT_AND_CAPITALIZED'
  | 'CAPITAL_BUFFER_BREACH'
  | 'LIQUIDITY_RUN_RISK'
  | 'REGULATORY_HALT';

export interface BaselTieredThresholds {
  standardLabel: string;
  signaturePrefix: string;
  minCet1Bps: number;
  cet1Label: string;
  minLcrBps: number;
  lcrLabel: string;
  minNsfrBps: number;
  nsfrLabel: string;
  targetBufferCents: number;
  bufferLabel: string;
  minSurvivalDays: number;
  survivalLabel: string;
}

export function evaluateTieredBaselSolvency(
  input: BaselTieredSolvencyInput,
  thresholds: BaselTieredThresholds,
) {
  const violations: string[] = [];

  const { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps } =
    calculateBaselSolvencyRatios(input);

  if (cet1RatioBps < thresholds.minCet1Bps) {
    violations.push(
      `CET1 ratio ${cet1RatioBps} bps breaches ${thresholds.standardLabel} minimum ${thresholds.minCet1Bps} bps (${thresholds.cet1Label})`,
    );
  }

  if (liquidityCoverageRatioBps < thresholds.minLcrBps) {
    violations.push(
      `LCR ${liquidityCoverageRatioBps} bps breaches ${thresholds.standardLabel} minimum ${thresholds.minLcrBps} bps (${thresholds.lcrLabel})`,
    );
  }

  if (netStableFundingRatioBps < thresholds.minNsfrBps) {
    violations.push(
      `NSFR ${netStableFundingRatioBps} bps breaches ${thresholds.standardLabel} minimum ${thresholds.minNsfrBps} bps (${thresholds.nsfrLabel})`,
    );
  }

  if (input.totalLiquidityBufferCents < thresholds.targetBufferCents) {
    violations.push(
      `Total liquidity buffer $${(input.totalLiquidityBufferCents / 100).toLocaleString()} below ${thresholds.bufferLabel} requirement`,
    );
  }

  if (input.stressTestSurvivalDays < thresholds.minSurvivalDays) {
    violations.push(
      `Stress test survival duration ${input.stressTestSurvivalDays} days is below ${thresholds.survivalLabel} ${thresholds.standardLabel} requirement`,
    );
  }

  const isSolvent = violations.length === 0;
  let solvencyStatus: BaselTieredSolvencyStatus = 'SOLVENT_AND_CAPITALIZED';

  if (!isSolvent) {
    if (
      cet1RatioBps < thresholds.minCet1Bps ||
      input.totalLiquidityBufferCents < thresholds.targetBufferCents
    ) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH';
    } else if (liquidityCoverageRatioBps < thresholds.minLcrBps) {
      solvencyStatus = 'LIQUIDITY_RUN_RISK';
    } else {
      solvencyStatus = 'REGULATORY_HALT';
    }
  }

  const supervisorySignature = createHash('sha256')
    .update(
      `${thresholds.signaturePrefix}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${input.totalLiquidityBufferCents}:${isSolvent}:${solvencyStatus}`,
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
