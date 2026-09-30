/**
 * @file basel-xxii-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XXII Solvency (CET1 ≥ 75.00%, LCR ≥ 5000.00%, NSFR ≥ 1200.00%) & $1.0 Quadrillion Sovereign Reserve Singularity.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateQuadrillionCollateralValue,
  evaluateBaselXxiiSolvency,
} from '../basel-xxii-solvency-engine';

describe('Basel XXII Solvency & $1.0 Quadrillion Sovereign Reserve Singularity Engine', () => {
  it('certifies solvency when meeting Basel XXII capital ratios and 365,000-day stress survival', () => {
    const result = evaluateBaselXxiiSolvency({
      commonEquityTier1Cents: 150_000_000_000_000_00, // $1.5T
      totalRiskExposureCents: 200_000_000_000_000_00, // $2.0T -> 75.00% CET1 (7500 bps >= 7500 bps)
      highQualityLiquidAssetsCents: 1_000_000_000_000_000_00, // $10.0T
      netCashOutflows30DaysCents: 20_000_000_000_000_00, // $200B -> 5000% LCR (500000 bps)
      availableStableFundingCents: 2_400_000_000_000_000_00, // $24.0T
      requiredStableFundingCents: 200_000_000_000_000_00, // $2.0T -> 1200% NSFR (120000 bps)
      sovereignCapitalBufferCents: 100_000_000_000_000_000, // $1.0 Quadrillion USD
      stressTestSurvivalDays: 365000, // 1,000 years
    });

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.cet1RatioBps).toBe(7500);
    expect(result.liquidityCoverageRatioBps).toBe(500000);
    expect(result.netStableFundingRatioBps).toBe(120000);
    expect(result.violations).toHaveLength(0);
    expect(result.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('triggers supervisory intervention and capital breach when thresholds are violated', () => {
    const breach = evaluateBaselXxiiSolvency({
      commonEquityTier1Cents: 100_000_000_000_000_00, // 50.00% CET1 < 75.00%
      totalRiskExposureCents: 200_000_000_000_000_00,
      highQualityLiquidAssetsCents: 600_000_000_000_000_00, // 3000% LCR < 5000%
      netCashOutflows30DaysCents: 20_000_000_000_000_00,
      availableStableFundingCents: 1_600_000_000_000_000_00, // 800% NSFR < 1200%
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 50_000_000_000_000_000, // < $1.0Q
      stressTestSurvivalDays: 182500, // 500 years < 1,000 years
    });

    expect(breach.isSolvent).toBe(false);
    expect(breach.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(breach.violations.length).toBeGreaterThanOrEqual(4);
    expect(breach.violations.some((v) => v.includes('CET1 Ratio'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('Liquidity Coverage Ratio'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('365,000 days'))).toBe(true);
  });

  it('computes haircut-adjusted collateral valuations accurately across Quadrillion asset classes', () => {
    const gold = calculateQuadrillionCollateralValue(1_050_000_00, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.05);
    expect(gold.netValuationCents).toBe(1_000_000_00);

    const subPlanckFoam = calculateQuadrillionCollateralValue(140_000_000_000_000_000, 'QUADRILLION_SUB_PLANCK_FOAM');
    expect(subPlanckFoam.haircutFactor).toBe(1.40);
    expect(subPlanckFoam.netValuationCents).toBe(100_000_000_000_000_000); // Exactly $1.0Q unencumbered
  });
});
