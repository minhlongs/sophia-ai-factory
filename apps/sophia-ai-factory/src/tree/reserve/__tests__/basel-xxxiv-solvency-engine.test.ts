/**
 * @file basel-xxxiv-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XXXIV Millia-Quadrillion Solvency Engine ($10,000.0Q Sovereign Capital Buffer, 27,397-Year Survival).
 */

import { describe, expect, it } from 'vitest';
import {
  calculateMilliaquadrillionCollateralValue,
  evaluateBaselXxxivSolvency,
} from '../basel-xxxiv-solvency-engine';

describe('Basel XXXIV Solvency & $10,000.0Q Capital Buffer Engine', () => {
  it('certifies full solvency under Basel XXXIV standards (99.80% CET1, 50000.00% LCR, 10000.00% NSFR, $10,000.0Q buffer)', () => {
    const collateral = calculateMilliaquadrillionCollateralValue(
      1_100_000_000_000_000_000_000,
      'MILLIAQUADRILLION_SUB_PLANCK_FOAM'
    );
    expect(collateral.netValuationCents).toBe(1_000_000_000_000_000_000_000); // Exactly $10,000.0Q net buffer

    const solvency = evaluateBaselXxxivSolvency({
      commonEquityTier1Cents: 998_000_000_000_000_00, // 99.80% CET1
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 5_000_000_000_000_000_00, // 50000.00% LCR
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 20_000_000_000_000_000_00, // 10000.00% NSFR
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: collateral.netValuationCents,
      stressTestSurvivalDays: 10000000, // 27,397 years
    });

    expect(solvency.isSolvent).toBe(true);
    expect(solvency.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(solvency.cet1RatioBps).toBe(9980);
    expect(solvency.liquidityCoverageRatioBps).toBe(5000000);
    expect(solvency.netStableFundingRatioBps).toBe(1000000);
    expect(solvency.violations).toHaveLength(0);
    expect(solvency.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects capital buffer breach when buffer falls below $10,000.0Q', () => {
    const solvency = evaluateBaselXxxivSolvency({
      commonEquityTier1Cents: 998_000_000_000_000_00,
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 5_100_000_000_000_000_00,
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 20_500_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 500_000_000_000_000_000_000, // $5,000.0Q < $10,000.0Q requirement
      stressTestSurvivalDays: 10000000,
    });

    expect(solvency.isSolvent).toBe(false);
    expect(solvency.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(solvency.violations.some((v) => v.includes('$10,000.0Q requirement'))).toBe(true);
  });

  it('accurately computes BigInt collateral haircut adjustments across asset tiers', () => {
    const gold = calculateMilliaquadrillionCollateralValue(1_012_000_000_000_000_000, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.012);
    expect(gold.netValuationCents).toBe(1_000_000_000_000_000_000);

    const credits = calculateMilliaquadrillionCollateralValue(1_060_000_000_000_000_000, 'MILLIAQUADRILLION_CREDITS');
    expect(credits.haircutFactor).toBe(1.06);
    expect(credits.netValuationCents).toBe(1_000_000_000_000_000_000);
  });
});
