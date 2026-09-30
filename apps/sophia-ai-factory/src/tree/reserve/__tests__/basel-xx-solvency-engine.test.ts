/**
 * @file basel-xx-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XX Solvency (CET1 ≥ 65.00%, LCR ≥ 3500.00%, NSFR ≥ 900.00%) & $250.0 Trillion Sovereign Reserve Singularity.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateMetaverseCollateralValue,
  evaluateBaselXxSolvency,
} from '../basel-xx-solvency-engine';

describe('Basel XX Solvency & $250.0 Trillion Sovereign Reserve Singularity Engine', () => {
  it('certifies solvency when meeting Basel XX capital ratios and 109,500-day stress survival', () => {
    const result = evaluateBaselXxSolvency({
      commonEquityTier1Cents: 130_000_000_000_000_00, // $1.3T
      totalRiskExposureCents: 200_000_000_000_000_00, // $2.0T -> 65.00% CET1 (6500 bps >= 6500 bps)
      highQualityLiquidAssetsCents: 700_000_000_000_000_00, // $7.0T
      netCashOutflows30DaysCents: 20_000_000_000_000_00, // $200B -> 3500% LCR (350000 bps)
      availableStableFundingCents: 1_800_000_000_000_000_00, // $18.0T
      requiredStableFundingCents: 200_000_000_000_000_00, // $2.0T -> 900% NSFR (90000 bps)
      sovereignCapitalBufferCents: 250_000_000_000_000_00, // $250.0 Trillion USD
      stressTestSurvivalDays: 109500, // 300 years
    });

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.cet1RatioBps).toBe(6500);
    expect(result.liquidityCoverageRatioBps).toBe(350000);
    expect(result.netStableFundingRatioBps).toBe(90000);
    expect(result.violations).toHaveLength(0);
    expect(result.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('triggers supervisory intervention and capital breach when thresholds are violated', () => {
    const breach = evaluateBaselXxSolvency({
      commonEquityTier1Cents: 100_000_000_000_000_00, // 50.00% CET1 < 65.00%
      totalRiskExposureCents: 200_000_000_000_000_00,
      highQualityLiquidAssetsCents: 400_000_000_000_000_00, // 2000% LCR < 3500%
      netCashOutflows30DaysCents: 20_000_000_000_000_00,
      availableStableFundingCents: 1_200_000_000_000_000_00, // 600% NSFR < 900%
      requiredStableFundingCents: 200_000_000_000_000_00,
      sovereignCapitalBufferCents: 150_000_000_000_000_00, // < $250.0T
      stressTestSurvivalDays: 73000, // 200 years < 300 years
    });

    expect(breach.isSolvent).toBe(false);
    expect(breach.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(breach.violations.length).toBeGreaterThanOrEqual(4);
    expect(breach.violations.some((v) => v.includes('CET1 Ratio'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('Liquidity Coverage Ratio'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('109,500 days'))).toBe(true);
  });

  it('computes haircut-adjusted collateral valuations accurately across metaverse asset classes', () => {
    const gold = calculateMetaverseCollateralValue(1_050_000_00, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.05);
    expect(gold.netValuationCents).toBe(1_000_000_00);

    const subPlanckFoam = calculateMetaverseCollateralValue(350_000_000_000_000_00, 'METAVERSE_SUB_PLANCK_FOAM');
    expect(subPlanckFoam.haircutFactor).toBe(1.40);
    expect(subPlanckFoam.netValuationCents).toBe(250_000_000_000_000_00); // Exactly $250.0T unencumbered
  });
});
