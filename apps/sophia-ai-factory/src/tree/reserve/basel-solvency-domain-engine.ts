/**
 * @file basel-solvency-domain-engine.ts
 * @layer tree/reserve
 * @description Canonical parameterized domain engine for Basel Solvency Ratios, Capital Adequacy & Sovereign Reserve Grid.
 */

import { createHash } from 'node:crypto';

export interface BaselSolvencyInput {
  commonEquityTier1Cents: number;
  totalRiskExposureCents: number;
  highQualityLiquidAssetsCents: number;
  netCashOutflows30DaysCents: number;
  availableStableFundingCents: number;
  requiredStableFundingCents: number;
  totalLiquidityBufferCents?: number;
  sovereignCapitalBufferCents?: number;
  stressTestSurvivalDays: number;
}

export interface BaselSolvencyTargets {
  minCet1RatioBps: number;
  minLcrBps: number;
  minNsfrBps: number;
  minSovereignBufferCents?: number;
  minStressSurvivalDays?: number;
  defaultCet1RatioBps?: number;
  defaultLcrBps?: number;
  defaultNsfrBps?: number;
}

export interface BaselSolvencySignatureContext {
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  bufferCents: number;
  stressTestSurvivalDays: number;
  isSolvent: boolean;
  solvencyStatus: string;
}

export interface BaselSolvencyConfig {
  hashPrefix?: string;
  signatureFn?: (ctx: BaselSolvencySignatureContext) => string;
  statusResolver?: (ctx: BaselSolvencySignatureContext, violations: string[]) => string;
  violationsGenerator?: (ctx: BaselSolvencySignatureContext, targets: BaselSolvencyTargets, input: BaselSolvencyInput) => string[];
}

export interface BaselSolvencyResult {
  isSolvent: boolean;
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
  totalLiquidityBufferCents?: number;
  sovereignCapitalBufferCents?: number;
  stressTestSurvivalDays: number;
  solvencyStatus?: string;
  violations: string[];
  supervisorySignature: string;
}

export interface CollateralValuationResult {
  assetType: string;
  nominalValueCents: number;
  haircutFactor: number;
  haircutMultiplier: number;
  netValuationCents: number;
}

/**
 * Calculates net haircut-adjusted collateral value.
 */
export function calculateParameterizedCollateralValue(
  pledgedAmountCents: number,
  assetType: string,
  haircuts: Record<string, number>,
  defaultHaircut: number = 1.5
): CollateralValuationResult {
  const factor = haircuts[assetType] ?? defaultHaircut;
  let netValuationCents: number;

  if (pledgedAmountCents > 1e14) {
    const factorScaled = BigInt(Math.round(factor * 10000));
    const pledgedScaled = BigInt(Math.round(pledgedAmountCents)) * 10000n;
    netValuationCents = Number(pledgedScaled / factorScaled);
  } else {
    netValuationCents = Math.floor(pledgedAmountCents / factor);
  }

  return {
    assetType,
    nominalValueCents: pledgedAmountCents,
    haircutFactor: factor,
    haircutMultiplier: factor,
    netValuationCents,
  };
}

/**
 * Calculates core Basel solvency ratios (CET1, LCR, NSFR).
 */
export function calculateBaselSolvencyRatios(
  input: BaselSolvencyInput,
  defaults?: { defaultCet1RatioBps?: number; defaultLcrBps?: number; defaultNsfrBps?: number }
) {
  const cet1RatioBps =
    input.totalRiskExposureCents > 0
      ? Math.floor((input.commonEquityTier1Cents / input.totalRiskExposureCents) * 10_000)
      : (defaults?.defaultCet1RatioBps ?? 0);

  const liquidityCoverageRatioBps =
    input.netCashOutflows30DaysCents > 0
      ? Math.floor((input.highQualityLiquidAssetsCents / input.netCashOutflows30DaysCents) * 10_000)
      : (defaults?.defaultLcrBps ?? 0);

  const netStableFundingRatioBps =
    input.requiredStableFundingCents > 0
      ? Math.floor((input.availableStableFundingCents / input.requiredStableFundingCents) * 10_000)
      : (defaults?.defaultNsfrBps ?? 0);

  return { cet1RatioBps, liquidityCoverageRatioBps, netStableFundingRatioBps };
}

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
  const minSurvivalDays = targets.minStressSurvivalDays ?? 90;

  const violations: string[] = [];
  if (config.violationsGenerator) {
    const tempCtx: BaselSolvencySignatureContext = {
      cet1RatioBps,
      liquidityCoverageRatioBps,
      netStableFundingRatioBps,
      bufferCents,
      stressTestSurvivalDays: input.stressTestSurvivalDays,
      isSolvent: true,
      solvencyStatus: 'SOLVENT_AND_CAPITALIZED',
    };
    violations.push(...config.violationsGenerator(tempCtx, targets, input));
  } else {
    if (cet1RatioBps < targets.minCet1RatioBps) {
      violations.push(
        `CET1 ratio ${cet1RatioBps} bps breaches minimum threshold ${targets.minCet1RatioBps} bps`
      );
    }
    if (liquidityCoverageRatioBps < targets.minLcrBps) {
      violations.push(
        `LCR ${liquidityCoverageRatioBps} bps breaches minimum threshold ${targets.minLcrBps} bps`
      );
    }
    if (netStableFundingRatioBps < targets.minNsfrBps) {
      violations.push(
        `NSFR ${netStableFundingRatioBps} bps breaches minimum threshold ${targets.minNsfrBps} bps`
      );
    }
    if (targets.minSovereignBufferCents !== undefined && bufferCents < targets.minSovereignBufferCents) {
      violations.push(
        `Sovereign buffer ${bufferCents} is below minimum requirement ${targets.minSovereignBufferCents} cents`
      );
    }
    if (input.stressTestSurvivalDays < minSurvivalDays) {
      violations.push(
        `Stress test survival duration ${input.stressTestSurvivalDays} days is below ${minSurvivalDays}-day requirement`
      );
    }
  }

  const isSolvent = violations.length === 0;

  let solvencyStatus = isSolvent ? 'SOLVENT_AND_CAPITALIZED' : 'INSOLVENT_HALT';
  if (targets.minSovereignBufferCents && bufferCents < targets.minSovereignBufferCents) {
    solvencyStatus = 'CAPITAL_BUFFER_BREACH';
  } else if (liquidityCoverageRatioBps < targets.minLcrBps) {
    solvencyStatus = 'LIQUIDITY_RESTRICTED';
  } else if (!isSolvent) {
    solvencyStatus = 'INSOLVENT_HALT';
  }

  const ctx: BaselSolvencySignatureContext = {
    cet1RatioBps,
    liquidityCoverageRatioBps,
    netStableFundingRatioBps,
    bufferCents,
    stressTestSurvivalDays: input.stressTestSurvivalDays,
    isSolvent,
    solvencyStatus,
  };

  if (config.statusResolver) {
    solvencyStatus = config.statusResolver(ctx, violations);
    ctx.solvencyStatus = solvencyStatus;
  }

  let supervisorySignature: string;
  if (config.signatureFn) {
    supervisorySignature = config.signatureFn(ctx);
  } else {
    const prefix = config.hashPrefix ?? 'BASEL_SOLVENCY';
    supervisorySignature = createHash('sha256')
      .update(`${prefix}:${solvencyStatus}:${cet1RatioBps}:${liquidityCoverageRatioBps}:${netStableFundingRatioBps}:${bufferCents}:${isSolvent}`)
      .digest('hex');
  }

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
