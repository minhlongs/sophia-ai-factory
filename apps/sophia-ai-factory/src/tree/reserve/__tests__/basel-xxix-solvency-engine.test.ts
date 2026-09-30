/**
 * @file basel-xxix-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XXIX Ducenti-Quadrillion Solvency Engine ($250.0Q Sovereign Capital Buffer, 9,589-Year Survival).
 */

import { describe, expect, it } from 'vitest';
import {
  calculateDucentiquadrillionCollateralValue,
  evaluateBaselXxixSolvency,
} from '../basel-xxix-solvency-engine';

describe('Basel XXIX Solvency & $250.0Q Capital Buffer Engine', () => {
  it('certifies full solvency under Basel XXIX standards (98.00% CET1, 20000.00% LCR, 4500.00% NSFR, $250.0Q buffer)', () => {
    const collateral = calculateDucentiquadrillionCollateralValue(
      31_250_000_000_000_000_000,
      'DUCENTIQUADRILLION_SUB_PLANCK_FOAM'
    );
    expect(collateral.netValuationCents).toBe(25_000_000_000_000_000_000); // Exactly $250.0Q net buffer

    const solvency = evaluateBaselXxixSolvency({
      commonEquityTier1Cents: 980_000_000_000_000_00, // 98.00% CET1
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 2_000_000_000_000_000_00, // 20000.00% LCR
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 9_000_000_000_000_000_00, // 4500.00% NSFR
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: collateral.netValuationCents,
      stressTestSurvivalDays: 3500000, // 9,589 years
    });

    expect(solvency.isSolvent).toBe(true);
    expect(solvency.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(solvency.cet1RatioBps).toBe(9800);
    expect(solvency.liquidityCoverageRatioBps).toBe(2000000);
    expect(solvency.netStableFundingRatioBps).toBe(450000);
    expect(solvency.violations).toHaveLength(0);
    expect(solvency.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects capital buffer breach when buffer falls below $250.0Q', () => {
    const solvency = evaluateBaselXxixSolvency({
      commonEquityTier1Cents: 990_000_000_000_000_00,
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 2_100_000_000_000_000_00,
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 9_500_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 10_000_000_000_000_000_000, // $100.0Q < $250.0Q requirement
      stressTestSurvivalDays: 3500000,
    });

    expect(solvency.isSolvent).toBe(false);
    expect(solvency.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(solvency.violations.some((v) => v.includes('$250.0Q requirement'))).toBe(true);
  });

  it('accurately computes BigInt collateral haircut adjustments across asset tiers', () => {
    const gold = calculateDucentiquadrillionCollateralValue(1_025_000_000_000_000_000, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.025);
    expect(gold.netValuationCents).toBe(1_000_000_000_000_000_000);

    const credits = calculateDucentiquadrillionCollateralValue(1_150_000_000_000_000_000, 'DUCENTIQUADRILLION_CREDITS');
    expect(credits.haircutFactor).toBe(1.15);
    expect(credits.netValuationCents).toBe(1_000_000_000_000_000_000);
  });
});
