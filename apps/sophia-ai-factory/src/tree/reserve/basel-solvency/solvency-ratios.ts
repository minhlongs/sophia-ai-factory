import type { BaselSolvencyInput } from './types';

/**
 * Calculates core Basel solvency ratios (CET1, LCR, NSFR).
 */
export function calculateBaselSolvencyRatios(
  input: BaselSolvencyInput,
  defaults?: { defaultCet1RatioBps?: number; defaultLcrBps?: number; defaultNsfrBps?: number }
): {
  cet1RatioBps: number;
  liquidityCoverageRatioBps: number;
  netStableFundingRatioBps: number;
} {
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
