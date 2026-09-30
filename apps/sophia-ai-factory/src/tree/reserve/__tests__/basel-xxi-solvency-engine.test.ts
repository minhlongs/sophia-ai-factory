/**
 * @file basel-xxi-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XXI Solvency (CET1 ≥ 70.00%, LCR ≥ 4000.00%, NSFR ≥ 1000.00%) & $500.0 Trillion Sovereign Reserve Singularity.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateInfiniteCollateralValue,
  evaluateBaselXxiSolvency,
} from '../basel-xxi-solvency-engine';

describe('Basel XXI Solvency & $500.0 Trillion Sovereign Reserve Singularity Engine', () => {
  it('certifies solvency when meeting Basel XXI capital ratios and 182,500-day stress survival', () => {
    const result = evaluateBaselXxiSolvency({
      commonEquityTier1Cents: 140_000_000_000_000_00, // $1.4T
      totalRiskExposureCents: 200_000_000_000_000_00, // $2.0T -> 70.00% CET1 (7000 bps >= 7000 bps)
      highQualityLiquidAssetsCents: 800_000_000_000_000_00, // $8.0T
      netCashOutflows30DaysCents: 20_000_000_000_000_00, // $200B -> 4000% LCR (400000 bps)
      availableStableFundingCents: 2_000_000_000_000_000_00, // $20.0T
      requiredStableFundingCents: 200_000_000_000_000_00, // $2.0T -> 1000% NSFR (100000 bps)
      sovereignCapitalBufferCents: 500_000_000_000_000_00, // $500.0 Trillion USD
      stressTestSurvivalDays: 182500, // 500 years
    });

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.cet1RatioBps).toBe(7000);
    expect(result.liquidityCoverageRatioBps).toBe(400000);
    expect(result.netStableFundingRatioBps).toBe(100000);
    expect(result.violations).toHaveLength(0);
    expect(result.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('triggers supervisory intervention and capital breach when thresholds are violated', () => {
    const breach = evaluateBaselXxiSolvency({
      commonEquityTier1Cents: 100_000_000_000_000_00, // 50.00% CET1 < 70.00%
      totalRiskExposureCents: 200_000_000_000_000_00,
      highQualityLiquidAssetsCents: 400_000_000_000_000_00, // 2000% LCR < 4000%
      netCashOutflows30DaysCents: 20_000_000_000_000_00,
      availableStableFundingCents: 1_200_000_000_000_000_00, // 600% NSFR < 1000%
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 300_000_000_000_000_00, // < $500.0T
      stressTestSurvivalDays: 109500, // 300 years < 500 years
    });

    expect(breach.isSolvent).toBe(false);
    expect(breach.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(breach.violations.length).toBeGreaterThanOrEqual(4);
    expect(breach.violations.some((v) => v.includes('CET1 Ratio'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('Liquidity Coverage Ratio'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('182,500 days'))).toBe(true);
  });

  it('computes haircut-adjusted collateral valuations accurately across infinite multiverse asset classes', () => {
    const gold = calculateInfiniteCollateralValue(1_050_000_00, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.05);
    expect(gold.netValuationCents).toBe(1_000_000_00);

    const subPlanckFoam = calculateInfiniteCollateralValue(700_000_000_000_000_00, 'INFINITE_SUB_PLANCK_FOAM');
    expect(subPlanckFoam.haircutFactor).toBe(1.40);
    expect(subPlanckFoam.netValuationCents).toBe(500_000_000_000_000_00); // Exactly $500.0T unencumbered
  });
});
