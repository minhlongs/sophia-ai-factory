/**
 * @file basel-xxxv-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XXXV Ducenti-Quinquaginta-Millia-Quadrillion Solvency Engine ($25,000.0Q Sovereign Capital Buffer, 34,246-Year Survival).
 */

import { describe, expect, it } from 'vitest';
import {
  calculateDucentiquinquagintamilliaquadrillionCollateralValue,
  evaluateBaselXxxvSolvency,
} from '../basel-xxxv-solvency-engine';

describe('Basel XXXV Solvency & $25,000.0Q Capital Buffer Engine', () => {
  it('certifies full solvency under Basel XXXV standards (99.85% CET1, 60000.00% LCR, 12000.00% NSFR, $25,000.0Q buffer)', () => {
    const collateral = calculateDucentiquinquagintamilliaquadrillionCollateralValue(
      2_700_000_000_000_000_000_000,
      'DUCENTIQUINQUAGINTAMILLIAQUADRILLION_SUB_PLANCK_FOAM'
    );
    expect(collateral.netValuationCents).toBe(2_500_000_000_000_000_000_000); // Exactly $25,000.0Q net buffer

    const solvency = evaluateBaselXxxvSolvency({
      commonEquityTier1Cents: 998_500_000_000_000_00, // 99.85% CET1
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 6_000_000_000_000_000_00, // 60000.00% LCR
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 24_000_000_000_000_000_00, // 12000.00% NSFR
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: collateral.netValuationCents,
      stressTestSurvivalDays: 12500000, // 34,246 years
    });

    expect(solvency.isSolvent).toBe(true);
    expect(solvency.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(solvency.cet1RatioBps).toBe(9985);
    expect(solvency.liquidityCoverageRatioBps).toBe(6000000);
    expect(solvency.netStableFundingRatioBps).toBe(1200000);
    expect(solvency.violations).toHaveLength(0);
    expect(solvency.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects capital buffer breach when buffer falls below $25,000.0Q', () => {
    const solvency = evaluateBaselXxxvSolvency({
      commonEquityTier1Cents: 998_500_000_000_000_00,
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 6_100_000_000_000_000_00,
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 25_000_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 1_250_000_000_000_000_000_000, // $12,500.0Q < $25,000.0Q requirement
      stressTestSurvivalDays: 12500000,
    });

    expect(solvency.isSolvent).toBe(false);
    expect(solvency.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(solvency.violations.some((v) => v.includes('$25,000.0Q requirement'))).toBe(true);
  });

  it('accurately computes BigInt collateral haircut adjustments across asset tiers', () => {
    const gold = calculateDucentiquinquagintamilliaquadrillionCollateralValue(1_010_000_000_000_000_000, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.010);
    expect(gold.netValuationCents).toBe(1_000_000_000_000_000_000);

    const credits = calculateDucentiquinquagintamilliaquadrillionCollateralValue(1_050_000_000_000_000_000, 'DUCENTIQUINQUAGINTAMILLIAQUADRILLION_CREDITS');
    expect(credits.haircutFactor).toBe(1.05);
    expect(credits.netValuationCents).toBe(1_000_000_000_000_000_000);
  });
});
