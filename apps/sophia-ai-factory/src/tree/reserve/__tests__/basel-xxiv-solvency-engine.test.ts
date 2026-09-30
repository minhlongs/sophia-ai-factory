/**
 * @file basel-xxiv-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XXIV Solvency (CET1 ≥ 85.00%, LCR ≥ 8000.00%, NSFR ≥ 2000.00%) & $5.0 Quadrillion Sovereign Reserve Singularity.
 */

import { describe, expect, it } from 'vitest';
import {
  calculatePentaquadrillionCollateralValue,
  evaluateBaselXxivSolvency,
} from '../basel-xxiv-solvency-engine';

describe('Basel XXIV Solvency & $5.0 Quadrillion Sovereign Reserve Singularity Engine', () => {
  it('certifies solvency when meeting Basel XXIV capital ratios and 1,000,000-day stress survival', () => {
    const result = evaluateBaselXxivSolvency({
      commonEquityTier1Cents: 170_000_000_000_000_00, // $1.7T
      totalRiskExposureCents: 200_000_000_000_000_00, // $2.0T -> 85.00% CET1 (8500 bps >= 8500 bps)
      highQualityLiquidAssetsCents: 1_600_000_000_000_000_00, // $16.0T
      netCashOutflows30DaysCents: 20_000_000_000_000_00, // $200B -> 8000% LCR (800000 bps)
      availableStableFundingCents: 4_000_000_000_000_000_00, // $40.0T
      requiredStableFundingCents: 200_000_000_000_000_00, // $2.0T -> 2000% NSFR (200000 bps)
      sovereignCapitalBufferCents: 500_000_000_000_000_000, // $5.0 Quadrillion USD
      stressTestSurvivalDays: 1000000, // 2,740 years
    });

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.cet1RatioBps).toBe(8500);
    expect(result.liquidityCoverageRatioBps).toBe(800000);
    expect(result.netStableFundingRatioBps).toBe(200000);
    expect(result.violations).toHaveLength(0);
    expect(result.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('triggers supervisory intervention and capital breach when thresholds are violated', () => {
    const breach = evaluateBaselXxivSolvency({
      commonEquityTier1Cents: 100_000_000_000_000_00, // 50.00% CET1 < 85.00%
      totalRiskExposureCents: 200_000_000_000_000_00,
      highQualityLiquidAssetsCents: 800_000_000_000_000_00, // 4000% LCR < 8000%
      netCashOutflows30DaysCents: 20_000_000_000_000_00,
      availableStableFundingCents: 2_000_000_000_000_000_00, // 1000% NSFR < 2000%
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 100_000_000_000_000_000, // < $5.0Q
      stressTestSurvivalDays: 500000, // < 1,000,000 days
    });

    expect(breach.isSolvent).toBe(false);
    expect(breach.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(breach.violations.length).toBeGreaterThanOrEqual(4);
    expect(breach.violations.some((v) => v.includes('CET1 Ratio'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('Liquidity Coverage Ratio'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('1,000,000 days'))).toBe(true);
  });

  it('computes haircut-adjusted collateral valuations accurately across Penta-Quadrillion asset classes', () => {
    const gold = calculatePentaquadrillionCollateralValue(1_040_000_00, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.04);
    expect(gold.netValuationCents).toBe(1_000_000_00);

    const subPlanckFoam = calculatePentaquadrillionCollateralValue(675_000_000_000_000_000, 'PENTAQUADRILLION_SUB_PLANCK_FOAM');
    expect(subPlanckFoam.haircutFactor).toBe(1.35);
    expect(subPlanckFoam.netValuationCents).toBe(500_000_000_000_000_000); // Exactly $5.0Q unencumbered
  });
});
