/**
 * @file basel-xxvii-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XXVII Quinquaginti-Quadrillion Solvency Engine ($50.0Q Sovereign Capital Buffer, 6,849-Year Survival).
 */

import { describe, expect, it } from 'vitest';
import {
  calculateQuinquagintiquadrillionCollateralValue,
  evaluateBaselXxviiSolvency,
} from '../basel-xxvii-solvency-engine';

describe('Basel XXVII Solvency & $50.0Q Capital Buffer Engine', () => {
  it('certifies full solvency under Basel XXVII standards (95.00% CET1, 15000.00% LCR, 3500.00% NSFR, $50.0Q buffer)', () => {
    const collateral = calculateQuinquagintiquadrillionCollateralValue(
      6_250_000_000_000_000_000,
      'QUINQUAGINTIQUADRILLION_SUB_PLANCK_FOAM'
    );
    expect(collateral.netValuationCents).toBe(5_000_000_000_000_000_000); // Exactly $50.0Q net buffer

    const solvency = evaluateBaselXxviiSolvency({
      commonEquityTier1Cents: 950_000_000_000_000_00, // 95.00% CET1
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 1_500_000_000_000_000_00, // 15000.00% LCR
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 7_000_000_000_000_000_00, // 3500.00% NSFR
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: collateral.netValuationCents,
      stressTestSurvivalDays: 2500000, // 6,849 years
    });

    expect(solvency.isSolvent).toBe(true);
    expect(solvency.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(solvency.cet1RatioBps).toBe(9500);
    expect(solvency.liquidityCoverageRatioBps).toBe(1500000);
    expect(solvency.netStableFundingRatioBps).toBe(350000);
    expect(solvency.violations).toHaveLength(0);
    expect(solvency.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects capital buffer breach when buffer falls below $50.0Q', () => {
    const solvency = evaluateBaselXxviiSolvency({
      commonEquityTier1Cents: 960_000_000_000_000_00,
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 1_600_000_000_000_000_00,
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 7_000_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 2_500_000_000_000_000_000, // $25.0Q < $50.0Q requirement
      stressTestSurvivalDays: 2500000,
    });

    expect(solvency.isSolvent).toBe(false);
    expect(solvency.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(solvency.violations.some((v) => v.includes('$50.0Q requirement'))).toBe(true);
  });

  it('accurately computes BigInt collateral haircut adjustments across asset tiers', () => {
    const gold = calculateQuinquagintiquadrillionCollateralValue(1_025_000_000_000_000_000, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.025);
    expect(gold.netValuationCents).toBe(1_000_000_000_000_000_000);

    const credits = calculateQuinquagintiquadrillionCollateralValue(1_150_000_000_000_000_000, 'QUINQUAGINTIQUADRILLION_CREDITS');
    expect(credits.haircutFactor).toBe(1.15);
    expect(credits.netValuationCents).toBe(1_000_000_000_000_000_000);
  });
});
