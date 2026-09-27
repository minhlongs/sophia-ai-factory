/**
 * @file basel-vii-solvency-engine.test.ts
 * @layer tree/reserve
 * @description Unit tests for Basel VII capital solvency engine and multi-asset collateral haircuts.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateInterstellarCollateralValue,
  evaluateBaselViiSolvency,
} from '../basel-vii-solvency-engine';

describe('BaselViiSolvencyEngine', () => {
  it('calculates net haircut collateral values across multi-asset reserves', () => {
    const gold = calculateInterstellarCollateralValue(108_000_000_000, 'PHYSICAL_GOLD'); // 1.08 haircut
    expect(gold.netValuationCents).toBe(100_000_000_000);
    expect(gold.haircutFactor).toBe(1.08);

    const bonds = calculateInterstellarCollateralValue(102_000_000_000, 'SOVEREIGN_BONDS'); // 1.02 haircut
    expect(bonds.netValuationCents).toBe(100_000_000_000);
    expect(bonds.haircutFactor).toBe(1.02);
  });

  it('certifies compliant Basel VII solvency with CET1 >= 22%, LCR >= 350%, NSFR >= 160% and $10B buffer', () => {
    const result = evaluateBaselViiSolvency({
      commonEquityTier1Cents: 1_200_000_000_000, // $12.0B
      totalRiskExposureCents: 5_000_000_000_000, // $50.0B -> CET1 = 24.00% (>= 22.00%)
      highQualityLiquidAssetsCents: 1_800_000_000_000, // $18.0B
      netCashOutflows30DaysCents: 500_000_000_000, // $5.0B -> LCR = 360.00% (>= 350.00%)
      availableStableFundingCents: 1_000_000_000_000, // $10.0B
      requiredStableFundingCents: 600_000_000_000, // $6.0B -> NSFR = 166.66% (>= 160.00%)
      totalLiquidityBufferCents: 1_000_000_000_000, // $10.0B
      stressTestSurvivalDays: 180,
    });

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.cet1RatioBps).toBe(2400);
    expect(result.liquidityCoverageRatioBps).toBe(36000);
    expect(result.netStableFundingRatioBps).toBe(16666);
    expect(result.violations).toHaveLength(0);
    expect(result.supervisorySignature).toHaveLength(64);
  });

  it('flags capital buffer breach when CET1 or liquidity buffer falls below Basel VII minimums', () => {
    const result = evaluateBaselViiSolvency({
      commonEquityTier1Cents: 500_000_000_000, // $5.0B
      totalRiskExposureCents: 5_000_000_000_000, // $50.0B -> CET1 = 10.00% (< 22.00%)
      highQualityLiquidAssetsCents: 500_000_000_000,
      netCashOutflows30DaysCents: 500_000_000_000, // -> LCR = 100.00% (< 350.00%)
      availableStableFundingCents: 500_000_000_000,
      requiredStableFundingCents: 600_000_000_000, // -> NSFR = 83.33% (< 160.00%)
      totalLiquidityBufferCents: 500_000_000_000, // $5.0B (< $10.0B)
      stressTestSurvivalDays: 90, // < 180 days
    });

    expect(result.isSolvent).toBe(false);
    expect(result.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(result.violations.length).toBeGreaterThanOrEqual(4);
  });
});
