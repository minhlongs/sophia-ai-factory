import type {
  BaselSolvencyInput,
  BaselSolvencyTargets,
  BaselSolvencySignatureContext,
} from './types';

export function checkStandardViolations(
  ctx: BaselSolvencySignatureContext,
  targets: BaselSolvencyTargets,
  input: BaselSolvencyInput
): string[] {
  const violations: string[] = [];
  const minSurvivalDays = targets.minStressSurvivalDays ?? 90;

  if (ctx.cet1RatioBps < targets.minCet1RatioBps) {
    violations.push(
      `CET1 ratio ${ctx.cet1RatioBps} bps breaches minimum threshold ${targets.minCet1RatioBps} bps`
    );
  }
  if (ctx.liquidityCoverageRatioBps < targets.minLcrBps) {
    violations.push(
      `LCR ${ctx.liquidityCoverageRatioBps} bps breaches minimum threshold ${targets.minLcrBps} bps`
    );
  }
  if (ctx.netStableFundingRatioBps < targets.minNsfrBps) {
    violations.push(
      `NSFR ${ctx.netStableFundingRatioBps} bps breaches minimum threshold ${targets.minNsfrBps} bps`
    );
  }
  if (targets.minSovereignBufferCents !== undefined && ctx.bufferCents < targets.minSovereignBufferCents) {
    violations.push(
      `Sovereign buffer ${ctx.bufferCents} is below minimum requirement ${targets.minSovereignBufferCents} cents`
    );
  }
  if (input.stressTestSurvivalDays < minSurvivalDays) {
    violations.push(
      `Stress test survival duration ${input.stressTestSurvivalDays} days is below ${minSurvivalDays}-day requirement`
    );
  }
  return violations;
}

export function resolveStandardSolvencyStatus(
  isSolvent: boolean,
  bufferCents: number,
  minSovereignBufferCents: number | undefined,
  lcrBps: number,
  minLcrBps: number
): string {
  if (minSovereignBufferCents && bufferCents < minSovereignBufferCents) {
    return 'CAPITAL_BUFFER_BREACH';
  }
  if (lcrBps < minLcrBps) {
    return 'LIQUIDITY_RESTRICTED';
  }
  return isSolvent ? 'SOLVENT_AND_CAPITALIZED' : 'INSOLVENT_HALT';
}
