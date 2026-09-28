/**
 * @file basel-xvi-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XVI Solvency (CET1 ≥ 45.00%, LCR ≥ 1500.00%, NSFR ≥ 500.00%) & $10.0 Trillion Treasury Singularity.
 */

import { describe, expect, it } from 'vitest';
import {
  calculatePanCosmicCollateralValue,
  evaluateBaselXviSolvency,
} from '../basel-xvi-solvency-engine';

describe('Basel XVI Solvency & $10.0 Trillion Treasury Singularity Engine', () => {
  it('certifies solvency when meeting Basel XVI capital ratios and 10,950-day stress survival', () => {
    const result = evaluateBaselXviSolvency({
      commonEquityTier1Cents: 50_000_000_000_000_00, // $500B
      totalRiskExposureCents: 100_000_000_000_000_00, // $1T -> 50.00% CET1 (5000 bps >= 4500 bps)
      highQualityLiquidAssetsCents: 150_000_000_000_000_00, // $1.5T
      netCashOutflows30DaysCents: 10_000_000_000_000_00, // $100B -> 1500% LCR (150000 bps)
      availableStableFundingCents: 500_000_000_000_000_00, // $5.0T
      requiredStableFundingCents: 100_000_000_000_000_00, // $1.0T -> 500% NSFR (50000 bps)
      sovereignCapitalBufferCents: 10_000_000_000_000_00, // $10.0 Trillion USD
      stressTestSurvivalDays: 10950, // 30 years
    });

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.cet1RatioBps).toBe(5000);
    expect(result.liquidityCoverageRatioBps).toBe(150000);
    expect(result.netStableFundingRatioBps).toBe(50000);
    expect(result.violations).toHaveLength(0);
    expect(result.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('triggers supervisory intervention and capital breach when thresholds are violated', () => {
    const breach = evaluateBaselXviSolvency({
      commonEquityTier1Cents: 40_000_000_000_000_00, // 40.00% CET1 < 45.00%
      totalRiskExposureCents: 100_000_000_000_000_00,
      highQualityLiquidAssetsCents: 100_000_000_000_000_00, // 1000% LCR < 1500%
      netCashOutflows30DaysCents: 10_000_000_000_000_00,
      availableStableFundingCents: 300_000_000_000_000_00, // 300% NSFR < 500%
      requiredStableFundingCents: 100_000_000_000_000_00,
      sovereignCapitalBufferCents: 8_000_000_000_000_00, // < $10.0T
      stressTestSurvivalDays: 3650, // 10 years < 30 years
    });

    expect(breach.isSolvent).toBe(false);
    expect(breach.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(breach.violations.length).toBeGreaterThanOrEqual(4);
    expect(breach.violations.some((v) => v.includes('CET1 Ratio'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('Liquidity Coverage Ratio'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('10,950 days'))).toBe(true);
  });

  it('computes haircut-adjusted collateral valuations accurately across pan-cosmic asset classes', () => {
    const gold = calculatePanCosmicCollateralValue(1_050_000_00, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.05);
    expect(gold.netValuationCents).toBe(1_000_000_00);

    const quantumFoam = calculatePanCosmicCollateralValue(14_000_000_000_000_00, 'PAN_DIMENSIONAL_QUANTUM_FOAM');
    expect(quantumFoam.haircutFactor).toBe(1.40);
    expect(quantumFoam.netValuationCents).toBe(10_000_000_000_000_00); // Exactly $10.0T unencumbered
  });
});
