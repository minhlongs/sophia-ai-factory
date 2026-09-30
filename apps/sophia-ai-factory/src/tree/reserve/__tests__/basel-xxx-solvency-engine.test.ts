/**
 * @file basel-xxx-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XXX Quinquaginta-Quadrillion Solvency Engine ($500.0Q Sovereign Capital Buffer, 10,958-Year Survival).
 */

import { describe, expect, it } from 'vitest';
import {
  calculateQuinquagintaquadrillionCollateralValue,
  evaluateBaselXxxSolvency,
} from '../basel-xxx-solvency-engine';

describe('Basel XXX Solvency & $500.0Q Capital Buffer Engine', () => {
  it('certifies full solvency under Basel XXX standards (98.50% CET1, 25000.00% LCR, 5000.00% NSFR, $500.0Q buffer)', () => {
    const collateral = calculateQuinquagintaquadrillionCollateralValue(
      62_500_000_000_000_000_000,
      'QUINQUAGINTAQUADRILLION_SUB_PLANCK_FOAM'
    );
    expect(collateral.netValuationCents).toBe(50_000_000_000_000_000_000); // Exactly $500.0Q net buffer

    const solvency = evaluateBaselXxxSolvency({
      commonEquityTier1Cents: 985_000_000_000_000_00, // 98.50% CET1
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 2_500_000_000_000_000_00, // 25000.00% LCR
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 10_000_000_000_000_000_00, // 5000.00% NSFR
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: collateral.netValuationCents,
      stressTestSurvivalDays: 4000000, // 10,958 years
    });

    expect(solvency.isSolvent).toBe(true);
    expect(solvency.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(solvency.cet1RatioBps).toBe(9850);
    expect(solvency.liquidityCoverageRatioBps).toBe(2500000);
    expect(solvency.netStableFundingRatioBps).toBe(500000);
    expect(solvency.violations).toHaveLength(0);
    expect(solvency.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects capital buffer breach when buffer falls below $500.0Q', () => {
    const solvency = evaluateBaselXxxSolvency({
      commonEquityTier1Cents: 990_000_000_000_000_00,
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 2_600_000_000_000_000_00,
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 10_500_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 25_000_000_000_000_000_000, // $250.0Q < $500.0Q requirement
      stressTestSurvivalDays: 4000000,
    });

    expect(solvency.isSolvent).toBe(false);
    expect(solvency.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(solvency.violations.some((v) => v.includes('$500.0Q requirement'))).toBe(true);
  });

  it('accurately computes BigInt collateral haircut adjustments across asset tiers', () => {
    const gold = calculateQuinquagintaquadrillionCollateralValue(1_025_000_000_000_000_000, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.025);
    expect(gold.netValuationCents).toBe(1_000_000_000_000_000_000);

    const credits = calculateQuinquagintaquadrillionCollateralValue(1_150_000_000_000_000_000, 'QUINQUAGINTAQUADRILLION_CREDITS');
    expect(credits.haircutFactor).toBe(1.15);
    expect(credits.netValuationCents).toBe(1_000_000_000_000_000_000);
  });
});
