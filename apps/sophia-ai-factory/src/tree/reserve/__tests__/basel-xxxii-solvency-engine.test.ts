/**
 * @file basel-xxxii-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XXXII Ducenti-Quinquaginta-Quadrillion Solvency Engine ($2,500.0Q Sovereign Capital Buffer, 16,438-Year Survival).
 */

import { describe, expect, it } from 'vitest';
import {
  calculateDucentiquinquagintaquadrillionCollateralValue,
  evaluateBaselXxxiiSolvency,
} from '../basel-xxxii-solvency-engine';

describe('Basel XXXII Solvency & $2,500.0Q Capital Buffer Engine', () => {
  it('certifies full solvency under Basel XXXII standards (99.50% CET1, 35000.00% LCR, 7000.00% NSFR, $2,500.0Q buffer)', () => {
    const collateral = calculateDucentiquinquagintaquadrillionCollateralValue(
      287_500_000_000_000_000_000,
      'DUCENTIQUINQUAGINTAQUADRILLION_SUB_PLANCK_FOAM'
    );
    expect(collateral.netValuationCents).toBe(250_000_000_000_000_000_000); // Exactly $2,500.0Q net buffer

    const solvency = evaluateBaselXxxiiSolvency({
      commonEquityTier1Cents: 995_000_000_000_000_00, // 99.50% CET1
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 3_500_000_000_000_000_00, // 35000.00% LCR
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 14_000_000_000_000_000_00, // 7000.00% NSFR
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: collateral.netValuationCents,
      stressTestSurvivalDays: 6000000, // 16,438 years
    });

    expect(solvency.isSolvent).toBe(true);
    expect(solvency.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(solvency.cet1RatioBps).toBe(9950);
    expect(solvency.liquidityCoverageRatioBps).toBe(3500000);
    expect(solvency.netStableFundingRatioBps).toBe(700000);
    expect(solvency.violations).toHaveLength(0);
    expect(solvency.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects capital buffer breach when buffer falls below $2,500.0Q', () => {
    const solvency = evaluateBaselXxxiiSolvency({
      commonEquityTier1Cents: 995_000_000_000_000_00,
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 3_600_000_000_000_000_00,
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 14_500_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 100_000_000_000_000_000_000, // $1,000.0Q < $2,500.0Q requirement
      stressTestSurvivalDays: 6000000,
    });

    expect(solvency.isSolvent).toBe(false);
    expect(solvency.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(solvency.violations.some((v) => v.includes('$2,500.0Q requirement'))).toBe(true);
  });

  it('accurately computes BigInt collateral haircut adjustments across asset tiers', () => {
    const gold = calculateDucentiquinquagintaquadrillionCollateralValue(1_015_000_000_000_000_000, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.015);
    expect(gold.netValuationCents).toBe(1_000_000_000_000_000_000);

    const credits = calculateDucentiquinquagintaquadrillionCollateralValue(1_100_000_000_000_000_000, 'DUCENTIQUINQUAGINTAQUADRILLION_CREDITS');
    expect(credits.haircutFactor).toBe(1.10);
    expect(credits.netValuationCents).toBe(1_000_000_000_000_000_000);
  });
});
