/**
 * @file basel-xvii-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XVII Solvency (CET1 ≥ 50.00%, LCR ≥ 2000.00%, NSFR ≥ 600.00%) & $25.0 Trillion Treasury Singularity.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateOmniCosmicCollateralValue,
  evaluateBaselXviiSolvency,
} from '../basel-xvii-solvency-engine';

describe('Basel XVII Solvency & $25.0 Trillion Treasury Singularity Engine', () => {
  it('certifies solvency when meeting Basel XVII capital ratios and 18,250-day stress survival', () => {
    const result = evaluateBaselXviiSolvency({
      commonEquityTier1Cents: 100_000_000_000_000_00, // $1.0T
      totalRiskExposureCents: 200_000_000_000_000_00, // $2.0T -> 50.00% CET1 (5000 bps >= 5000 bps)
      highQualityLiquidAssetsCents: 400_000_000_000_000_00, // $4.0T
      netCashOutflows30DaysCents: 20_000_000_000_000_00, // $200B -> 2000% LCR (200000 bps)
      availableStableFundingCents: 1_200_000_000_000_000_00, // $12.0T
      requiredStableFundingCents: 200_000_000_000_000_00, // $2.0T -> 600% NSFR (60000 bps)
      sovereignCapitalBufferCents: 25_000_000_000_000_00, // $25.0 Trillion USD
      stressTestSurvivalDays: 18250, // 50 years
    });

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.cet1RatioBps).toBe(5000);
    expect(result.liquidityCoverageRatioBps).toBe(200000);
    expect(result.netStableFundingRatioBps).toBe(60000);
    expect(result.violations).toHaveLength(0);
    expect(result.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('triggers supervisory intervention and capital breach when thresholds are violated', () => {
    const breach = evaluateBaselXviiSolvency({
      commonEquityTier1Cents: 90_000_000_000_000_00, // 45.00% CET1 < 50.00%
      totalRiskExposureCents: 200_000_000_000_000_00,
      highQualityLiquidAssetsCents: 300_000_000_000_000_00, // 1500% LCR < 2000%
      netCashOutflows30DaysCents: 20_000_000_000_000_00,
      availableStableFundingCents: 800_000_000_000_000_00, // 400% NSFR < 600%
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 20_000_000_000_000_00, // < $25.0T
      stressTestSurvivalDays: 10950, // 30 years < 50 years
    });

    expect(breach.isSolvent).toBe(false);
    expect(breach.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(breach.violations.length).toBeGreaterThanOrEqual(4);
    expect(breach.violations.some((v) => v.includes('CET1 Ratio'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('Liquidity Coverage Ratio'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('18,250 days'))).toBe(true);
  });

  it('computes haircut-adjusted collateral valuations accurately across omni-cosmic asset classes', () => {
    const gold = calculateOmniCosmicCollateralValue(1_050_000_00, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.05);
    expect(gold.netValuationCents).toBe(1_000_000_00);

    const planckFoam = calculateOmniCosmicCollateralValue(35_000_000_000_000_00, 'OMNI_DIMENSIONAL_PLANCK_FOAM');
    expect(planckFoam.haircutFactor).toBe(1.40);
    expect(planckFoam.netValuationCents).toBe(25_000_000_000_000_00); // Exactly $25.0T unencumbered
  });
});
