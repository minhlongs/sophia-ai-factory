/**
 * @file basel-xxiii-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XXIII Solvency (CET1 ≥ 80.00%, LCR ≥ 6000.00%, NSFR ≥ 1500.00%) & $2.0 Quadrillion Sovereign Reserve Singularity.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateBiquadrillionCollateralValue,
  evaluateBaselXxiiiSolvency,
} from '../basel-xxiii-solvency-engine';

describe('Basel XXIII Solvency & $2.0 Quadrillion Sovereign Reserve Singularity Engine', () => {
  it('certifies solvency when meeting Basel XXIII capital ratios and 730,000-day stress survival', () => {
    const result = evaluateBaselXxiiiSolvency({
      commonEquityTier1Cents: 160_000_000_000_000_00, // $1.6T
      totalRiskExposureCents: 200_000_000_000_000_00, // $2.0T -> 80.00% CET1 (8000 bps >= 8000 bps)
      highQualityLiquidAssetsCents: 1_200_000_000_000_000_00, // $12.0T
      netCashOutflows30DaysCents: 20_000_000_000_000_00, // $200B -> 6000% LCR (600000 bps)
      availableStableFundingCents: 3_000_000_000_000_000_00, // $30.0T
      requiredStableFundingCents: 200_000_000_000_000_00, // $2.0T -> 1500% NSFR (150000 bps)
      sovereignCapitalBufferCents: 200_000_000_000_000_000, // $2.0 Quadrillion USD
      stressTestSurvivalDays: 730000, // 2,000 years
    });

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.cet1RatioBps).toBe(8000);
    expect(result.liquidityCoverageRatioBps).toBe(600000);
    expect(result.netStableFundingRatioBps).toBe(150000);
    expect(result.violations).toHaveLength(0);
    expect(result.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('triggers supervisory intervention and capital breach when thresholds are violated', () => {
    const breach = evaluateBaselXxiiiSolvency({
      commonEquityTier1Cents: 100_000_000_000_000_00, // 50.00% CET1 < 80.00%
      totalRiskExposureCents: 200_000_000_000_000_00,
      highQualityLiquidAssetsCents: 600_000_000_000_000_00, // 3000% LCR < 6000%
      netCashOutflows30DaysCents: 20_000_000_000_000_00,
      availableStableFundingCents: 1_600_000_000_000_000_00, // 800% NSFR < 1500%
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 50_000_000_000_000_000, // < $2.0Q
      stressTestSurvivalDays: 365000, // 1,000 years < 2,000 years
    });

    expect(breach.isSolvent).toBe(false);
    expect(breach.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(breach.violations.length).toBeGreaterThanOrEqual(4);
    expect(breach.violations.some((v) => v.includes('CET1 Ratio'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('Liquidity Coverage Ratio'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('730,000 days'))).toBe(true);
  });

  it('computes haircut-adjusted collateral valuations accurately across Bi-Quadrillion asset classes', () => {
    const gold = calculateBiquadrillionCollateralValue(1_050_000_00, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.05);
    expect(gold.netValuationCents).toBe(1_000_000_00);

    const subPlanckFoam = calculateBiquadrillionCollateralValue(280_000_000_000_000_000, 'BIQUADRILLION_SUB_PLANCK_FOAM');
    expect(subPlanckFoam.haircutFactor).toBe(1.40);
    expect(subPlanckFoam.netValuationCents).toBe(200_000_000_000_000_000); // Exactly $2.0Q unencumbered
  });
});
