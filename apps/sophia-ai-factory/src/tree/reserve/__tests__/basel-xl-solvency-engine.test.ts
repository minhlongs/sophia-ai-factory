/**
 * @file basel-xl-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XL Solvency and Capital Adequacy Engine ($1,000,000.0Q Sovereign Buffer).
 */

import { describe, expect, it } from 'vitest';
import {
  calculateCentumquintillionCollateralValue,
  evaluateBaselXlSolvency,
} from '../basel-xl-solvency-engine';

describe('Basel XL Centum-Quintillion Solvency Engine', () => {
  it('certifies solvent capitalization with $1,000,000.0Q buffer and 50,000,000-day survival horizon', () => {
    const collateral = calculateCentumquintillionCollateralValue(
      103_000_000_000_000_000_000_000,
      'CENTUMQUINTILLION_SUB_PLANCK_FOAM'
    );

    const result = evaluateBaselXlSolvency({
      commonEquityTier1Cents: 999_900_000_000_000_00,
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 25_000_000_000_000_000_00,
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 70_000_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: collateral.netValuationCents,
      stressTestSurvivalDays: 50_000_000,
    });

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.cet1RatioBps).toBe(9999); // 99.99% >= 99.99%
    expect(result.liquidityCoverageRatioBps).toBe(25000000); // 250,000.00%
    expect(result.netStableFundingRatioBps).toBe(3500000); // 35,000.00%
    expect(result.sovereignCapitalBufferCents).toBeGreaterThanOrEqual(100_000_000_000_000_000_000_000); // $1,000,000.0Q
    expect(result.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
    expect(result.violations).toHaveLength(0);
  });

  it('detects violations when CET1 or LCR falls below Basel XL thresholds', () => {
    const result = evaluateBaselXlSolvency({
      commonEquityTier1Cents: 900_000_000_000_000_00, // 90.00% < 99.99%
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 500_000_000_000_000_00, // 5000.00% < 250000.00%
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 100_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 100_000_000_000_000_000_000_000,
      stressTestSurvivalDays: 50_000_000,
    });

    expect(result.isSolvent).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
  });

  it('triggers CAPITAL_BUFFER_BREACH when buffer is below $1,000,000.0Q USD requirement', () => {
    const result = evaluateBaselXlSolvency({
      commonEquityTier1Cents: 999_900_000_000_000_00,
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 25_000_000_000_000_000_00,
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 70_000_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 500_000_000_000_000_000_000_00, // $500,000.0Q < $1,000,000.0Q
      stressTestSurvivalDays: 50_000_000,
    });

    expect(result.isSolvent).toBe(false);
    expect(result.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
  });
});
