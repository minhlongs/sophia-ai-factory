/**
 * @file basel-xviii-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XVIII Solvency (CET1 ≥ 55.00%, LCR ≥ 2500.00%, NSFR ≥ 700.00%) & $50.0 Trillion Treasury Singularity.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateInterGalacticCollateralValue,
  evaluateBaselXviiiSolvency,
} from '../basel-xviii-solvency-engine';

describe('Basel XVIII Solvency & $50.0 Trillion Treasury Singularity Engine', () => {
  it('certifies solvency when meeting Basel XVIII capital ratios and 36,500-day stress survival', () => {
    const result = evaluateBaselXviiiSolvency({
      commonEquityTier1Cents: 110_000_000_000_000_00, // $1.1T
      totalRiskExposureCents: 200_000_000_000_000_00, // $2.0T -> 55.00% CET1 (5500 bps >= 5500 bps)
      highQualityLiquidAssetsCents: 500_000_000_000_000_00, // $5.0T
      netCashOutflows30DaysCents: 20_000_000_000_000_00, // $200B -> 2500% LCR (250000 bps)
      availableStableFundingCents: 1_400_000_000_000_000_00, // $14.0T
      requiredStableFundingCents: 200_000_000_000_000_00, // $2.0T -> 700% NSFR (70000 bps)
      sovereignCapitalBufferCents: 50_000_000_000_000_00, // $50.0 Trillion USD
      stressTestSurvivalDays: 36500, // 100 years
    });

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.cet1RatioBps).toBe(5500);
    expect(result.liquidityCoverageRatioBps).toBe(250000);
    expect(result.netStableFundingRatioBps).toBe(70000);
    expect(result.violations).toHaveLength(0);
    expect(result.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('triggers supervisory intervention and capital breach when thresholds are violated', () => {
    const breach = evaluateBaselXviiiSolvency({
      commonEquityTier1Cents: 90_000_000_000_000_00, // 45.00% CET1 < 55.00%
      totalRiskExposureCents: 200_000_000_000_000_00,
      highQualityLiquidAssetsCents: 300_000_000_000_000_00, // 1500% LCR < 2500%
      netCashOutflows30DaysCents: 20_000_000_000_000_00,
      availableStableFundingCents: 800_000_000_000_000_00, // 400% NSFR < 700%
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 30_000_000_000_000_00, // < $50.0T
      stressTestSurvivalDays: 18250, // 50 years < 100 years
    });

    expect(breach.isSolvent).toBe(false);
    expect(breach.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(breach.violations.length).toBeGreaterThanOrEqual(4);
    expect(breach.violations.some((v) => v.includes('CET1 Ratio'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('Liquidity Coverage Ratio'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('36,500 days'))).toBe(true);
  });

  it('computes haircut-adjusted collateral valuations accurately across inter-galactic asset classes', () => {
    const gold = calculateInterGalacticCollateralValue(1_050_000_00, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.05);
    expect(gold.netValuationCents).toBe(1_000_000_00);

    const subPlanckFoam = calculateInterGalacticCollateralValue(70_000_000_000_000_00, 'INTER_GALACTIC_SUB_PLANCK_FOAM');
    expect(subPlanckFoam.haircutFactor).toBe(1.40);
    expect(subPlanckFoam.netValuationCents).toBe(50_000_000_000_000_00); // Exactly $50.0T unencumbered
  });
});
