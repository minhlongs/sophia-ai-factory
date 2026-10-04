/**
 * @file basel-xxxiii-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XXXIII Quingenti-Quadrillion Solvency Engine ($5,000.0Q Sovereign Capital Buffer, 20,547-Year Survival).
 */

import { describe, expect, it } from 'vitest';
import {
  calculateQuingentiquadrillionCollateralValue,
  evaluateBaselXxxiiiSolvency,
} from '../basel-xxxiii-solvency-engine';

describe('Basel XXXIII Solvency & $5,000.0Q Capital Buffer Engine', () => {
  it('certifies full solvency under Basel XXXIII standards (99.70% CET1, 40000.00% LCR, 8000.00% NSFR, $5,000.0Q buffer)', () => {
    const collateral = calculateQuingentiquadrillionCollateralValue(
      560_000_000_000_000_000_000,
      'QUINGENTIQUADRILLION_SUB_PLANCK_FOAM'
    );
    expect(collateral.netValuationCents).toBe(500_000_000_000_000_000_000); // Exactly $5,000.0Q net buffer

    const solvency = evaluateBaselXxxiiiSolvency({
      commonEquityTier1Cents: 997_000_000_000_000_00, // 99.70% CET1
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 4_000_000_000_000_000_00, // 40000.00% LCR
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 16_000_000_000_000_000_00, // 8000.00% NSFR
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: collateral.netValuationCents,
      stressTestSurvivalDays: 7500000, // 20,547 years
    });

    expect(solvency.isSolvent).toBe(true);
    expect(solvency.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(solvency.cet1RatioBps).toBe(9970);
    expect(solvency.liquidityCoverageRatioBps).toBe(4000000);
    expect(solvency.netStableFundingRatioBps).toBe(800000);
    expect(solvency.violations).toHaveLength(0);
    expect(solvency.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects capital buffer breach when buffer falls below $5,000.0Q', () => {
    const solvency = evaluateBaselXxxiiiSolvency({
      commonEquityTier1Cents: 997_000_000_000_000_00,
      totalRiskExposureCents: 1000_000_000_000_000_00,
      highQualityLiquidAssetsCents: 4_100_000_000_000_000_00,
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 16_500_000_000_000_000_00,
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 200_000_000_000_000_000_000, // $2,000.0Q < $5,000.0Q requirement
      stressTestSurvivalDays: 7500000,
    });

    expect(solvency.isSolvent).toBe(false);
    expect(solvency.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(solvency.violations.some((v) => v.includes('$5,000.0Q requirement'))).toBe(true);
  });

  it('accurately computes BigInt collateral haircut adjustments across asset tiers', () => {
    const gold = calculateQuingentiquadrillionCollateralValue(1_015_000_000_000_000_000, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.015);
    expect(gold.netValuationCents).toBe(1_000_000_000_000_000_000);

    const credits = calculateQuingentiquadrillionCollateralValue(1_080_000_000_000_000_000, 'QUINGENTIQUADRILLION_CREDITS');
    expect(credits.haircutFactor).toBe(1.08);
    expect(credits.netValuationCents).toBe(1_000_000_000_000_000_000);
  });
});
