/**
 * @file basel-xxxi-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XXXI Centummillia-Quadrillion Solvency Engine ($1,000.0Q Sovereign Capital Buffer, 13,698-Year Survival).
 */

import { describe, expect, it } from 'vitest';
import {
  calculateCentummilliaquadrillionCollateralValue,
  evaluateBaselXxxiSolvency,
} from '../basel-xxxi-solvency-engine';

describe('Basel XXXI Solvency & $1,000.0Q Capital Buffer Engine', () => {
  it('certifies full solvency under Basel XXXI standards (99.00% CET1, 30000.00% LCR, 6000.00% NSFR, $1,000.0Q buffer)', () => {
    const collateral = calculateCentummilliaquadrillionCollateralValue(
      120_000_000_000_000_000_000,
      'CENTUMMILLIAQUADRILLION_SUB_PLANCK_FOAM'
    );
    expect(collateral.netValuationCents).toBe(100_000_000_000_000_000_000); // Exactly $1,000.0Q net buffer

    const solvency = evaluateBaselXxxiSolvency({
      commonEquityTier1Cents: 990_000_000_000_000_00, // 99.00% CET1
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 3_000_000_000_000_000_00, // 30000.00% LCR
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 12_000_000_000_000_000_00, // 6000.00% NSFR
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: collateral.netValuationCents,
      stressTestSurvivalDays: 5000000, // 13,698 years
    });

    expect(solvency.isSolvent).toBe(true);
    expect(solvency.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(solvency.cet1RatioBps).toBe(9900);
    expect(solvency.liquidityCoverageRatioBps).toBe(3000000);
    expect(solvency.netStableFundingRatioBps).toBe(600000);
    expect(solvency.violations).toHaveLength(0);
    expect(solvency.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects capital buffer breach when buffer falls below $1,000.0Q', () => {
    const solvency = evaluateBaselXxxiSolvency({
      commonEquityTier1Cents: 995_000_000_000_000_00,
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 3_100_000_000_000_000_00,
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 12_500_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 50_000_000_000_000_000_000, // $500.0Q < $1,000.0Q requirement
      stressTestSurvivalDays: 5000000,
    });

    expect(solvency.isSolvent).toBe(false);
    expect(solvency.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(solvency.violations.some((v) => v.includes('$1,000.0Q requirement'))).toBe(true);
  });

  it('accurately computes BigInt collateral haircut adjustments across asset tiers', () => {
    const gold = calculateCentummilliaquadrillionCollateralValue(1_020_000_000_000_000_000, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.02);
    expect(gold.netValuationCents).toBe(1_000_000_000_000_000_000);

    const credits = calculateCentummilliaquadrillionCollateralValue(1_120_000_000_000_000_000, 'CENTUMMILLIAQUADRILLION_CREDITS');
    expect(credits.haircutFactor).toBe(1.12);
    expect(credits.netValuationCents).toBe(1_000_000_000_000_000_000);
  });
});
