/**
 * @file basel-xix-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XIX Solvency (CET1 ≥ 60.00%, LCR ≥ 3000.00%, NSFR ≥ 800.00%) & $100.0 Trillion Treasury Singularity.
 */

import { describe, expect, it } from 'vitest';
import {
  calculatePanDimensionalCollateralValue,
  evaluateBaselXixSolvency,
} from '../basel-xix-solvency-engine';

describe('Basel XIX Solvency & $100.0 Trillion Treasury Singularity Engine', () => {
  it('certifies solvency when meeting Basel XIX capital ratios and 73,000-day stress survival', () => {
    const result = evaluateBaselXixSolvency({
      commonEquityTier1Cents: 120_000_000_000_000_00, // $1.2T
      totalRiskExposureCents: 200_000_000_000_000_00, // $2.0T -> 60.00% CET1 (6000 bps >= 6000 bps)
      highQualityLiquidAssetsCents: 600_000_000_000_000_00, // $6.0T
      netCashOutflows30DaysCents: 20_000_000_000_000_00, // $200B -> 3000% LCR (300000 bps)
      availableStableFundingCents: 1_600_000_000_000_000_00, // $16.0T
      requiredStableFundingCents: 200_000_000_000_000_00, // $2.0T -> 800% NSFR (80000 bps)
      sovereignCapitalBufferCents: 100_000_000_000_000_00, // $100.0 Trillion USD
      stressTestSurvivalDays: 73000, // 200 years
    });

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.cet1RatioBps).toBe(6000);
    expect(result.liquidityCoverageRatioBps).toBe(300000);
    expect(result.netStableFundingRatioBps).toBe(80000);
    expect(result.violations).toHaveLength(0);
    expect(result.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('triggers supervisory intervention and capital breach when thresholds are violated', () => {
    const breach = evaluateBaselXixSolvency({
      commonEquityTier1Cents: 100_000_000_000_000_00, // 50.00% CET1 < 60.00%
      totalRiskExposureCents: 200_000_000_000_000_00,
      highQualityLiquidAssetsCents: 400_000_000_000_000_00, // 2000% LCR < 3000%
      netCashOutflows30DaysCents: 20_000_000_000_000_00,
      availableStableFundingCents: 1_200_000_000_000_000_00, // 600% NSFR < 800%
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 60_000_000_000_000_00, // < $100.0T
      stressTestSurvivalDays: 36500, // 100 years < 200 years
    });

    expect(breach.isSolvent).toBe(false);
    expect(breach.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(breach.violations.length).toBeGreaterThanOrEqual(4);
    expect(breach.violations.some((v) => v.includes('CET1 Ratio'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('Liquidity Coverage Ratio'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('73,000 days'))).toBe(true);
  });

  it('computes haircut-adjusted collateral valuations accurately across pan-dimensional asset classes', () => {
    const gold = calculatePanDimensionalCollateralValue(1_050_000_00, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.05);
    expect(gold.netValuationCents).toBe(1_000_000_00);

    const subPlanckFoam = calculatePanDimensionalCollateralValue(140_000_000_000_000_00, 'PAN_DIMENSIONAL_SUB_PLANCK_FOAM');
    expect(subPlanckFoam.haircutFactor).toBe(1.40);
    expect(subPlanckFoam.netValuationCents).toBe(100_000_000_000_000_00); // Exactly $100.0T unencumbered
  });
});
