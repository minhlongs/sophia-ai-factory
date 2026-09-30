/**
 * @file basel-xxviii-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XXVIII Centum-Quadrillion Solvency Engine ($100.0Q Sovereign Capital Buffer, 8,219-Year Survival).
 */

import { describe, expect, it } from 'vitest';
import {
  calculateCentumquadrillionCollateralValue,
  evaluateBaselXxviiiSolvency,
} from '../basel-xxviii-solvency-engine';

describe('Basel XXVIII Solvency & $100.0Q Capital Buffer Engine', () => {
  it('certifies full solvency under Basel XXVIII standards (97.00% CET1, 18000.00% LCR, 4000.00% NSFR, $100.0Q buffer)', () => {
    const collateral = calculateCentumquadrillionCollateralValue(
      12_500_000_000_000_000_000,
      'CENTUMQUADRILLION_SUB_PLANCK_FOAM'
    );
    expect(collateral.netValuationCents).toBe(10_000_000_000_000_000_000); // Exactly $100.0Q net buffer

    const solvency = evaluateBaselXxviiiSolvency({
      commonEquityTier1Cents: 970_000_000_000_000_00, // 97.00% CET1
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 1_800_000_000_000_000_00, // 18000.00% LCR
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 8_000_000_000_000_000_00, // 4000.00% NSFR
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: collateral.netValuationCents,
      stressTestSurvivalDays: 3000000, // 8,219 years
    });

    expect(solvency.isSolvent).toBe(true);
    expect(solvency.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(solvency.cet1RatioBps).toBe(9700);
    expect(solvency.liquidityCoverageRatioBps).toBe(1800000);
    expect(solvency.netStableFundingRatioBps).toBe(400000);
    expect(solvency.violations).toHaveLength(0);
    expect(solvency.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects capital buffer breach when buffer falls below $100.0Q', () => {
    const solvency = evaluateBaselXxviiiSolvency({
      commonEquityTier1Cents: 980_000_000_000_000_00,
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 1_900_000_000_000_000_00,
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 9_000_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 5_000_000_000_000_000_000, // $50.0Q < $100.0Q requirement
      stressTestSurvivalDays: 3000000,
    });

    expect(solvency.isSolvent).toBe(false);
    expect(solvency.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(solvency.violations.some((v) => v.includes('$100.0Q requirement'))).toBe(true);
  });

  it('accurately computes BigInt collateral haircut adjustments across asset tiers', () => {
    const gold = calculateCentumquadrillionCollateralValue(1_025_000_000_000_000_000, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.025);
    expect(gold.netValuationCents).toBe(1_000_000_000_000_000_000);

    const credits = calculateCentumquadrillionCollateralValue(1_150_000_000_000_000_000, 'CENTUMQUADRILLION_CREDITS');
    expect(credits.haircutFactor).toBe(1.15);
    expect(credits.netValuationCents).toBe(1_000_000_000_000_000_000);
  });
});
