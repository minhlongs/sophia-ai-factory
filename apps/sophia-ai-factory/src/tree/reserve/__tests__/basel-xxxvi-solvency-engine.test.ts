/**
 * @file basel-xxxvi-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XXXVI Quingenti-Millia-Quadrillion Solvency Engine ($50,000.0Q Sovereign Capital Buffer, 41,095-Year Survival).
 */

import { describe, expect, it } from 'vitest';
import {
  calculateQuingentimilliaquadrillionCollateralValue,
  evaluateBaselXxxviSolvency,
} from '../basel-xxxvi-solvency-engine';

describe('Basel XXXVI Solvency & $50,000.0Q Capital Buffer Engine', () => {
  it('certifies full solvency under Basel XXXVI standards (99.90% CET1, 75000.00% LCR, 15000.00% NSFR, $50,000.0Q buffer)', () => {
    const collateral = calculateQuingentimilliaquadrillionCollateralValue(
      5_300_000_000_000_000_000_000,
      'QUINGENTIMILLIAQUADRILLION_SUB_PLANCK_FOAM'
    );
    expect(collateral.netValuationCents).toBe(5_000_000_000_000_000_000_000); // Exactly $50,000.0Q net buffer

    const solvency = evaluateBaselXxxviSolvency({
      commonEquityTier1Cents: 999_000_000_000_000_00, // 99.90% CET1
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 7_500_000_000_000_000_00, // 75000.00% LCR
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 30_000_000_000_000_000_00, // 15000.00% NSFR
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: collateral.netValuationCents,
      stressTestSurvivalDays: 15000000, // 41,095 years
    });

    expect(solvency.isSolvent).toBe(true);
    expect(solvency.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(solvency.cet1RatioBps).toBe(9990);
    expect(solvency.liquidityCoverageRatioBps).toBe(7500000);
    expect(solvency.netStableFundingRatioBps).toBe(1500000);
    expect(solvency.violations).toHaveLength(0);
    expect(solvency.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects capital buffer breach when buffer falls below $50,000.0Q', () => {
    const solvency = evaluateBaselXxxviSolvency({
      commonEquityTier1Cents: 999_000_000_000_000_00,
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 7_600_000_000_000_000_00,
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 31_000_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 2_500_000_000_000_000_000_000, // $25,000.0Q < $50,000.0Q requirement
      stressTestSurvivalDays: 15000000,
    });

    expect(solvency.isSolvent).toBe(false);
    expect(solvency.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(solvency.violations.some((v) => v.includes('$50,000.0Q requirement'))).toBe(true);
  });

  it('accurately computes BigInt collateral haircut adjustments across asset tiers', () => {
    const gold = calculateQuingentimilliaquadrillionCollateralValue(1_008_000_000_000_000_000, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.008);
    expect(gold.netValuationCents).toBe(1_000_000_000_000_000_000);

    const credits = calculateQuingentimilliaquadrillionCollateralValue(1_040_000_000_000_000_000, 'QUINGENTIMILLIAQUADRILLION_CREDITS');
    expect(credits.haircutFactor).toBe(1.04);
    expect(credits.netValuationCents).toBe(1_000_000_000_000_000_000);
  });
});
