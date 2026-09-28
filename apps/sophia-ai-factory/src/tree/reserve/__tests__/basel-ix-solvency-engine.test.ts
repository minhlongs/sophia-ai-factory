/**
 * @file basel-ix-solvency-engine.test.ts
 * @layer tree/reserve
 * @description Unit tests for Basel IX Trans-Universal Solvency & $50.0B Multi-Dimensional Capital Buffer.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMultidimensionalCollateralValue,
  evaluateBaselIxSolvency,
  type BaselIxSolvencyInput,
} from '../basel-ix-solvency-engine';

describe('BaselIxSolvencyEngine', () => {
  const solventInput: BaselIxSolvencyInput = {
    commonEquityTier1Cents: 5_000_000_000_00, // $50.0B
    totalRiskExposureCents: 15_000_000_000_00, // $150.0B -> CET1 = 33.33% (>= 28.00%)
    highQualityLiquidAssetsCents: 50_000_000_000_00, // $500B
    netCashOutflows30DaysCents: 8_000_000_000_00, // $80B -> LCR = 625% (>= 500.00%)
    availableStableFundingCents: 40_000_000_000_00, // $400B
    requiredStableFundingCents: 15_000_000_000_00, // $150B -> NSFR = 266.66% (>= 200.00%)
    totalLiquidityBufferCents: 50_000_000_000_00, // $50.0B target
    stressTestSurvivalDays: 800, // >= 730 days (2 years)
  };

  it('certifies sovereign solvency under compliant Basel IX metrics', () => {
    const result = evaluateBaselIxSolvency(solventInput);

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.cet1RatioBps).toBe(3333);
    expect(result.liquidityCoverageRatioBps).toBe(62500);
    expect(result.netStableFundingRatioBps).toBe(26666);
    expect(result.violations).toHaveLength(0);
    expect(result.supervisorySignature).toHaveLength(64);
  });

  it('detects and flags violations when ratios or buffer fall below Basel IX thresholds', () => {
    const deficientInput: BaselIxSolvencyInput = {
      ...solventInput,
      commonEquityTier1Cents: 2_000_000_000_00, // CET1 = 13.33% < 28.00%
      totalLiquidityBufferCents: 25_000_000_000_00, // $25B < $50B
      stressTestSurvivalDays: 365, // < 730 days
    };

    const result = evaluateBaselIxSolvency(deficientInput);

    expect(result.isSolvent).toBe(false);
    expect(result.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
    expect(result.violations[0]).toContain('CET1 ratio');
  });

  it('applies risk-weighted haircuts across multi-dimensional sovereign collateral assets', () => {
    const gold = calculateMultidimensionalCollateralValue(105_000_000, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.05);
    expect(gold.netValuationCents).toBe(100_000_000);

    const planck = calculateMultidimensionalCollateralValue(140_000_000, 'PLANCK_ENERGY_SINGULARITIES');
    expect(planck.haircutFactor).toBe(1.40);
    expect(planck.netValuationCents).toBe(100_000_000);
  });
});
