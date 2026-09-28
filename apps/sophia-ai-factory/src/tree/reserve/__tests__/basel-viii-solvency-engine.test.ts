/**
 * @file basel-viii-solvency-engine.test.ts
 * @layer tree/reserve
 * @description Unit tests for Basel VIII Extreme Solvency & $25.0B Sovereign Planetary Capital Buffer.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateGalacticCollateralValue,
  evaluateBaselViiiSolvency,
  type BaselViiiSolvencyInput,
} from '../basel-viii-solvency-engine';

describe('BaselViiiSolvencyEngine', () => {
  const solventInput: BaselViiiSolvencyInput = {
    commonEquityTier1Cents: 2_500_000_000_00, // $25.0B
    totalRiskExposureCents: 8_000_000_000_00, // $80.0B -> CET1 = 31.25% (>= 25.00%)
    highQualityLiquidAssetsCents: 20_000_000_000_00, // $200B
    netCashOutflows30DaysCents: 4_000_000_000_00, // $40B -> LCR = 500% (>= 400.00%)
    availableStableFundingCents: 15_000_000_000_00, // $150B
    requiredStableFundingCents: 6_000_000_000_00, // $60B -> NSFR = 250% (>= 180.00%)
    totalLiquidityBufferCents: 25_000_000_000_00, // $25.0B target
    stressTestSurvivalDays: 400, // >= 365 days
  };

  it('certifies sovereign solvency under compliant Basel VIII metrics', () => {
    const result = evaluateBaselViiiSolvency(solventInput);

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.cet1RatioBps).toBe(3125);
    expect(result.liquidityCoverageRatioBps).toBe(50000);
    expect(result.netStableFundingRatioBps).toBe(25000);
    expect(result.violations).toHaveLength(0);
    expect(result.supervisorySignature).toHaveLength(64);
  });

  it('detects and flags violations when ratios or buffer fall below Basel VIII thresholds', () => {
    const deficientInput: BaselViiiSolvencyInput = {
      ...solventInput,
      commonEquityTier1Cents: 1_000_000_000_00, // CET1 = 12.5% < 25.00%
      totalLiquidityBufferCents: 10_000_000_000_00, // $10B < $25B
      stressTestSurvivalDays: 120, // < 365 days
    };

    const result = evaluateBaselViiiSolvency(deficientInput);

    expect(result.isSolvent).toBe(false);
    expect(result.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
    expect(result.violations[0]).toContain('CET1 ratio');
  });

  it('applies risk-weighted haircuts across multi-galactic sovereign collateral assets', () => {
    const gold = calculateGalacticCollateralValue(108_000_000, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.06);
    expect(gold.netValuationCents).toBe(Math.floor(108_000_000 / 1.06));

    const crystals = calculateGalacticCollateralValue(145_000_000, 'K3_ENERGY_CRYSTALS');
    expect(crystals.haircutFactor).toBe(1.45);
    expect(crystals.netValuationCents).toBe(100_000_000);
  });
});
