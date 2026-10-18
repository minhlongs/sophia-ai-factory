/**
 * @file basel-trans-cosmic-solvency-helper.ts
 * @layer tree/reserve
 * @description Shared parameterized solvency evaluator for Basel XXXV–XXXVIII Trans-Cosmic Sovereign Reserve engines.
 */

import { createHash } from 'node:crypto';
import { calculateBaselSolvencyRatios } from './basel-solvency-domain-engine';

export interface TransCosmicSolvencyInputShape {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  sovereignCapitalBufferCents: number;
  stressTestSurvivalDays: number;
}

export interface TransCosmicSolvencyTierSpec<TStatus extends string> {
  tierName: string;
  minCet1Bps: number;
  cet1PctLabel: string;
  minLcrBps: number;
  lcrPctLabel: string;
  minNsfrBps: number;
  nsfrPctLabel: string;
  targetBufferCents: number;
  bufferViolationMessage: (actualCents: number, targetCents: number) => string;
  minSurvivalDays: number;
  survivalViolationMessage: (actualDays: number) => string;
  buildSignaturePayload: (ctx: {
    isSolvent: boolean;
    solvencyStatus: TStatus;
    cet1RatioBps: number;
    liquidityCoverageRatioBps: number;
    netStableFundingRatioBps: number;
    sovereignCapitalBufferCents: number;
    stressTestSurvivalDays: number;
  }) => string;
}

export function evaluateTransCosmicBaselSolvency<TStatus extends string>(
  input: TransCosmicSolvencyInputShape,
  spec: TransCosmicSolvencyTierSpec<TStatus>,
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

  if (cet1RatioBps < spec.minCet1Bps) {
    violations.push(
      `CET1 Ratio ${cet1RatioBps} bps is below ${spec.tierName} requirement of ${spec.minCet1Bps} bps (${spec.cet1PctLabel})`,
    );
  }

  if (liquidityCoverageRatioBps < spec.minLcrBps) {
    violations.push(
      `Liquidity Coverage Ratio ${liquidityCoverageRatioBps} bps is below ${spec.tierName} requirement of ${spec.minLcrBps} bps (${spec.lcrPctLabel})`,
    );
  }

  if (netStableFundingRatioBps < spec.minNsfrBps) {
    violations.push(
      `Net Stable Funding Ratio ${netStableFundingRatioBps} bps is below ${spec.tierName} requirement of ${spec.minNsfrBps} bps (${spec.nsfrPctLabel})`,
    );
  }

  if (input.sovereignCapitalBufferCents < spec.targetBufferCents) {
    violations.push(spec.bufferViolationMessage(input.sovereignCapitalBufferCents, spec.targetBufferCents));
  }

  if (input.stressTestSurvivalDays < spec.minSurvivalDays) {
    violations.push(spec.survivalViolationMessage(input.stressTestSurvivalDays));
  }

  let solvencyStatus = 'SOLVENT_AND_CAPITALIZED' as TStatus;
  if (violations.length > 0) {
    if (input.sovereignCapitalBufferCents < spec.targetBufferCents) {
      solvencyStatus = 'CAPITAL_BUFFER_BREACH' as TStatus;
    } else if (liquidityCoverageRatioBps < spec.minLcrBps) {
      solvencyStatus = 'LIQUIDITY_RUN_DEFICIT' as TStatus;
    } else {
      solvencyStatus = 'SUPERVISORY_INTERVENTION' as TStatus;
    }
  }

  const isSolvent = violations.length === 0;
  const supervisorySignature = createHash('sha256')
    .update(
      spec.buildSignaturePayload({
        isSolvent,
        solvencyStatus,
        cet1RatioBps,
        liquidityCoverageRatioBps,
        netStableFundingRatioBps,
        sovereignCapitalBufferCents: input.sovereignCapitalBufferCents,
        stressTestSurvivalDays: input.stressTestSurvivalDays,
      }),
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
