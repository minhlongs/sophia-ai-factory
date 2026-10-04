/**
 * @file basel-xxxvii-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XXXVII Solvency and Capital Adequacy Engine ($100,000.0Q Sovereign Buffer).
 */

import { describe, expect, it } from 'vitest';
import {
  calculateDecemmilliaquadrillionCollateralValue,
  evaluateBaselXxxviiSolvency,
} from '../basel-xxxvii-solvency-engine';

describe('Basel XXXVII Decem-Millia-Quadrillion Solvency Engine', () => {
  it('certifies solvent capitalization with $100,000.0Q buffer and 20,000,000-day survival horizon', () => {
    const collateral = calculateDecemmilliaquadrillionCollateralValue(
      10_500_000_000_000_000_000_000,
      'DECEMMILLIAQUADRILLION_SUB_PLANCK_FOAM'
    );

    const result = evaluateBaselXxxviiSolvency({
      commonEquityTier1Cents: 999_800_000_000_000_00,
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 10_000_000_000_000_000_00,
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 40_000_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: collateral.netValuationCents,
      stressTestSurvivalDays: 20_000_000,
    });

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.cet1RatioBps).toBe(9998); // 99.98% >= 99.95%
    expect(result.liquidityCoverageRatioBps).toBe(10000000); // 100,000.00%
    expect(result.netStableFundingRatioBps).toBe(2000000); // 20,000.00%
    expect(result.sovereignCapitalBufferCents).toBe(10_000_000_000_000_000_000_000); // $100,000.0Q
    expect(result.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
    expect(result.violations).toHaveLength(0);
  });

  it('detects violations when CET1 or LCR falls below Basel XXXVII thresholds', () => {
    const result = evaluateBaselXxxviiSolvency({
      commonEquityTier1Cents: 900_000_000_000_000_00, // 90.00% < 99.95%
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 500_000_000_000_000_00, // 5000.00% < 100000.00%
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 100_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 10_000_000_000_000_000_000_000,
      stressTestSurvivalDays: 20_000_000,
    });

    expect(result.isSolvent).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
  });

  it('triggers CAPITAL_BUFFER_BREACH when buffer is below $100,000.0Q USD requirement', () => {
    const result = evaluateBaselXxxviiSolvency({
      commonEquityTier1Cents: 999_800_000_000_000_00,
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 10_000_000_000_000_000_00,
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 40_000_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 5_000_000_000_000_000_000_000, // $50,000.0Q < $100,000.0Q
      stressTestSurvivalDays: 20_000_000,
    });

    expect(result.isSolvent).toBe(false);
    expect(result.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
  });
});
