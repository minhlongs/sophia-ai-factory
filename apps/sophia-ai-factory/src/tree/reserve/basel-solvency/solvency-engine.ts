import { createHash } from 'node:crypto';
import type {
  BaselSolvencyInput,
  BaselSolvencyTargets,
  BaselSolvencyConfig,
  BaselSolvencyResult,
  BaselSolvencySignatureContext,
} from './types';
import { calculateBaselSolvencyRatios } from './solvency-ratios';
import {
  checkStandardViolations,
  resolveStandardSolvencyStatus,
} from './violations-checker';

/**
 * Evaluates capital adequacy, liquidity coverage, and structural funding across Basel tiers.
 */
export function evaluateParameterizedBaselSolvency(
  input: BaselSolvencyInput,
  targets: BaselSolvencyTargets,
  config: BaselSolvencyConfig = {}
): BaselSolvencyResult {
  const ratios = calculateBaselSolvencyRatios(input, {
    defaultCet1RatioBps: targets.defaultCet1RatioBps,
    defaultLcrBps: targets.defaultLcrBps,
    defaultNsfrBps: targets.defaultNsfrBps,
  });
  const { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps } = ratios;
  const bufferCents = input.sovereignCapitalBufferCents ?? input.totalLiquidityBufferCents ?? 0;

  const tempCtx: BaselSolvencySignatureContext = {
    cet1RatioBps,
    liquidityCoverageRatioBps,
    netStableFundingRatioBps,
    bufferCents,
    stressTestSurvivalDays: input.stressTestSurvivalDays,
    isSolvent: true,
    solvencyStatus: 'SOLVENT_AND_CAPITALIZED',
  };

  const violations = config.violationsGenerator
    ? config.violationsGenerator(tempCtx, targets, input)
    : checkStandardViolations(tempCtx, targets, input);

  const isSolvent = violations.length === 0;

  let solvencyStatus = resolveStandardSolvencyStatus(
    isSolvent,
    bufferCents,
    targets.minSovereignBufferCents,
    liquidityCoverageRatioBps,
    targets.minLcrBps
  );

  const ctx: BaselSolvencySignatureContext = {
    ...tempCtx,
    isSolvent,
    solvencyStatus,
  };

  if (config.statusResolver) {
    solvencyStatus = config.statusResolver(ctx, violations);
    ctx.solvencyStatus = solvencyStatus;
  }

  const supervisorySignature = config.signatureFn
    ? config.signatureFn(ctx)
    : createHash('sha256')
        .update(
          `${config.hashPrefix ?? 'BASEL_SOLVENCY'}:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${bufferCents}:${isSolvent}`
        )
        .digest('hex');

  return {
    isSolvent,
    cet1RatioBps,
    liquidityCoverageRatioBps,
    netStableFundingRatioBps,
    totalLiquidityBufferCents: input.totalLiquidityBufferCents,
    sovereignCapitalBufferCents: input.sovereignCapitalBufferCents,
    stressTestSurvivalDays: input.stressTestSurvivalDays,
    solvencyStatus,
    violations,
    supervisorySignature,
  };
}
