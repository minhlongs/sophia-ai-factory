/**
 * @file basel-xxxviii-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XXXVIII Solvency and Capital Adequacy Engine ($250,000.0Q Sovereign Buffer).
 */

import { describe, expect, it } from 'vitest';
import {
  calculateVigintiquinquemilliaquadrillionCollateralValue,
  evaluateBaselXxxviiiSolvency,
} from '../basel-xxxviii-solvency-engine';

describe('Basel XXXVIII Viginti-Quinque-Millia-Quadrillion Solvency Engine', () => {
  it('certifies solvent capitalization with $250,000.0Q buffer and 25,000,000-day survival horizon', () => {
    const collateral = calculateVigintiquinquemilliaquadrillionCollateralValue(
      26_000_000_000_000_000_000_000,
      'VIGINTIQUINQUEMILLIAQUADRILLION_SUB_PLANCK_FOAM'
    );

    const result = evaluateBaselXxxviiiSolvency({
      commonEquityTier1Cents: 999_900_000_000_000_00,
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 15_000_000_000_000_000_00,
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 50_000_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: collateral.netValuationCents,
      stressTestSurvivalDays: 25_000_000,
    });

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.cet1RatioBps).toBe(9999); // 99.99% >= 99.98%
    expect(result.liquidityCoverageRatioBps).toBe(15000000); // 150,000.00%
    expect(result.netStableFundingRatioBps).toBe(2500000); // 25,000.00%
    expect(result.sovereignCapitalBufferCents).toBe(25_000_000_000_000_000_000_000); // $250,000.0Q
    expect(result.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
    expect(result.violations).toHaveLength(0);
  });

  it('detects violations when CET1 or LCR falls below Basel XXXVIII thresholds', () => {
    const result = evaluateBaselXxxviiiSolvency({
      commonEquityTier1Cents: 900_000_000_000_000_00, // 90.00% < 99.98%
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 500_000_000_000_000_00, // 5000.00% < 150000.00%
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 100_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 25_000_000_000_000_000_000_000,
      stressTestSurvivalDays: 25_000_000,
    });

    expect(result.isSolvent).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
  });

  it('triggers CAPITAL_BUFFER_BREACH when buffer is below $250,000.0Q USD requirement', () => {
    const result = evaluateBaselXxxviiiSolvency({
      commonEquityTier1Cents: 999_900_000_000_000_00,
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 15_000_000_000_000_000_00,
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 50_000_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 100_000_000_000_000_000_000_00, // $100,000.0Q < $250,000.0Q
      stressTestSurvivalDays: 25_000_000,
    });

    expect(result.isSolvent).toBe(false);
    expect(result.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
  });
});
