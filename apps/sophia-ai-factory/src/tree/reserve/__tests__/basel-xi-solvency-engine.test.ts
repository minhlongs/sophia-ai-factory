/**
 * @file basel-xi-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XI Trans-Cosmic Solvency & $250.0B Sovereign Treasury Mesh.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateInterdimensionalCollateralValue,
  evaluateBaselXiSolvency,
} from '../basel-xi-solvency-engine';

describe('Basel XI Solvency & $250.0B Sovereign Treasury Mesh Engine', () => {
  it('certifies full Basel XI solvency under standard Gate 21 conditions (CET1 >= 32%, LCR >= 700%, NSFR >= 250%, Buffer >= $250B)', () => {
    const result = evaluateBaselXiSolvency({
      commonEquityTier1Cents: 100_000_000_000_00, // $100.0B
      totalRiskExposureCents: 250_000_000_000_00, // $250.0B -> CET1 = 40.00% (4000 bps)
      highQualityLiquidAssetsCents: 80_000_000_000_00, // $80.0B
      netCashOutflows30DaysCents: 10_000_000_000_00, // $10.0B -> LCR = 800.00% (80000 bps)
      availableStableFundingCents: 90_000_000_000_00, // $90.0B
      requiredStableFundingCents: 30_000_000_000_00, // $30.0B -> NSFR = 300.00% (30000 bps)
      sovereignCapitalBufferCents: 250_000_000_000_00, // $250.0B
      stressTestSurvivalDays: 1825, // 5 years
    });

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.cet1RatioBps).toBe(4000);
    expect(result.liquidityCoverageRatioBps).toBe(80000);
    expect(result.netStableFundingRatioBps).toBe(30000);
    expect(result.violations).toHaveLength(0);
    expect(result.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects solvency breaches when CET1, LCR, or capital buffer is inadequate', () => {
    const deficient = evaluateBaselXiSolvency({
      commonEquityTier1Cents: 50_000_000_000_00, // $50B
      totalRiskExposureCents: 250_000_000_000_00, // CET1 = 20.00% (< 32.00%)
      highQualityLiquidAssetsCents: 40_000_000_000_00,
      netCashOutflows30DaysCents: 10_000_000_000_00, // LCR = 400.00% (< 700.00%)
      availableStableFundingCents: 50_000_000_000_00,
      requiredStableFundingCents: 30_000_000_000_00, // NSFR = 166.66% (< 250.00%)
      sovereignCapitalBufferCents: 100_000_000_000_00, // $100B (< $250.0B)
      stressTestSurvivalDays: 365, // 1 year (< 1,825 days)
    });

    expect(deficient.isSolvent).toBe(false);
    expect(deficient.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(deficient.violations.length).toBeGreaterThanOrEqual(4);
    expect(deficient.violations.some((v) => v.includes('CET1 Ratio'))).toBe(true);
    expect(deficient.violations.some((v) => v.includes('Liquidity Coverage Ratio'))).toBe(true);
    expect(deficient.violations.some((v) => v.includes('1,825 days'))).toBe(true);
  });

  it('calculates proper haircut haircuts for inter-dimensional collateral assets', () => {
    const gold = calculateInterdimensionalCollateralValue(105_000_00, 'PHYSICAL_GOLD'); // haircut 1.05
    expect(gold.haircutFactor).toBe(1.05);
    expect(gold.netValuationCents).toBe(100_000_00);

    const zeroPoint = calculateInterdimensionalCollateralValue(140_000_00, 'ZERO_POINT_FOAM_SINGULARITIES'); // haircut 1.40
    expect(zeroPoint.haircutFactor).toBe(1.40);
    expect(zeroPoint.netValuationCents).toBe(100_000_00);
  });
});
