/**
 * @file basel-xiii-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XIII Trans-Cosmic Solvency & $1.0 Trillion Multiverse Treasury Singularity.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateTransCosmicCollateralValue,
  evaluateBaselXiiiSolvency,
} from '../basel-xiii-solvency-engine';
import { GATE_23_SCALE_TARGETS } from '@/seed/types/trans-cosmic-hyper-rtgs-capital';

describe('Basel XIII Solvency & $1.0T Treasury Engine', () => {
  it('certifies full Basel XIII solvency when all ratios exceed regulatory thresholds', () => {
    const evaluation = evaluateBaselXiiiSolvency({
      commonEquityTier1Cents: 40_000_000_000_000_00, // $400.0B
      totalRiskExposureCents: 100_000_000_000_000_00, // $1.0T -> 40.00% CET1 >= 38.00%
      highQualityLiquidAssetsCents: 10_000_000_000_000_00, // $100.0B
      netCashOutflows30DaysCents: 1_000_000_000_000_00, // $10.0B -> 1000.00% LCR >= 900.00%
      availableStableFundingCents: 40_000_000_000_000_00, // $400.0B
      requiredStableFundingCents: 10_000_000_000_000_00, // $100.0B -> 400.00% NSFR >= 350.00%
      sovereignCapitalBufferCents: 1_000_000_000_000_00, // $1.0 Trillion
      stressTestSurvivalDays: 3650, // 10 years
    });

    expect(evaluation.isSolvent).toBe(true);
    expect(evaluation.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(evaluation.cet1RatioBps).toBe(4000);
    expect(evaluation.liquidityCoverageRatioBps).toBe(100000); // 10x = 1000% = 100,000 bps
    expect(evaluation.netStableFundingRatioBps).toBe(40000); // 4x = 400% = 40,000 bps
    expect(evaluation.violations).toHaveLength(0);
    expect(evaluation.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects violations and capital buffer breaches accurately', () => {
    const breach = evaluateBaselXiiiSolvency({
      commonEquityTier1Cents: 20_000_000_000_000_00, // 20% < 38%
      totalRiskExposureCents: 100_000_000_000_000_00,
      highQualityLiquidAssetsCents: 5_000_000_000_000_00, // 500% < 900%
      netCashOutflows30DaysCents: 1_000_000_000_000_00,
      availableStableFundingCents: 20_000_000_000_000_00, // 200% < 350%
      requiredStableFundingCents: 10_000_000_000_000_00,
      sovereignCapitalBufferCents: 500_000_000_000_00, // $500B < $1.0T
      stressTestSurvivalDays: 1800, // < 3650
    });

    expect(breach.isSolvent).toBe(false);
    expect(breach.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(breach.violations).toHaveLength(5);
  });

  it('applies cosmological haircuts correctly across various collateral asset tiers', () => {
    const bond = calculateTransCosmicCollateralValue(102_000_00, 'SOVEREIGN_BONDS');
    expect(bond.haircutFactor).toBe(1.02);
    expect(bond.netValuationCents).toBe(100_000_00);

    const gold = calculateTransCosmicCollateralValue(105_000_00, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.05);
    expect(gold.netValuationCents).toBe(100_000_00);

    const zeroPointSingularity = calculateTransCosmicCollateralValue(135_000_00, 'ZERO_POINT_VACUUM_SINGULARITIES');
    expect(zeroPointSingularity.haircutFactor).toBe(1.35);
    expect(zeroPointSingularity.netValuationCents).toBe(100_000_00);
  });
});
