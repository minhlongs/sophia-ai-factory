/**
 * @file basel-xiv-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XIV Pan-Galactic Solvency & $2.0 Trillion Multiverse Treasury Singularity.
 */

import { describe, expect, it } from 'vitest';
import {
  calculatePanGalacticCollateralValue,
  evaluateBaselXivSolvency,
} from '../basel-xiv-solvency-engine';
import { GATE_24_SCALE_TARGETS } from '@/seed/types/pan-galactic-hyper-rtgs-capital';

describe('Basel XIV Solvency & $2.0T Treasury Engine', () => {
  it('certifies full Basel XIV solvency when all ratios exceed regulatory thresholds', () => {
    const evaluation = evaluateBaselXivSolvency({
      commonEquityTier1Cents: 42_000_000_000_000_00, // $420.0B
      totalRiskExposureCents: 100_000_000_000_000_00, // $1.0T -> 42.00% CET1 >= 40.00%
      highQualityLiquidAssetsCents: 12_000_000_000_000_00, // $120.0B
      netCashOutflows30DaysCents: 1_000_000_000_000_00, // $10.0B -> 1200.00% LCR >= 1000.00%
      availableStableFundingCents: 45_000_000_000_000_00, // $450.0B
      requiredStableFundingCents: 10_000_000_000_000_00, // $100.0B -> 450.00% NSFR >= 400.00%
      sovereignCapitalBufferCents: 2_000_000_000_000_00, // $2.0 Trillion
      stressTestSurvivalDays: 5475, // 15 years
    });

    expect(evaluation.isSolvent).toBe(true);
    expect(evaluation.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(evaluation.cet1RatioBps).toBe(4200);
    expect(evaluation.liquidityCoverageRatioBps).toBe(120000); // 12x = 1200% = 120,000 bps
    expect(evaluation.netStableFundingRatioBps).toBe(45000); // 4.5x = 450% = 45,000 bps
    expect(evaluation.violations).toHaveLength(0);
    expect(evaluation.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects violations and capital buffer breaches accurately', () => {
    const breach = evaluateBaselXivSolvency({
      commonEquityTier1Cents: 20_000_000_000_000_00, // 20% < 40%
      totalRiskExposureCents: 100_000_000_000_000_00,
      highQualityLiquidAssetsCents: 5_000_000_000_000_00, // 500% < 1000%
      netCashOutflows30DaysCents: 1_000_000_000_000_00,
      availableStableFundingCents: 20_000_000_000_000_00, // 200% < 400%
      requiredStableFundingCents: 10_000_000_000_000_00,
      sovereignCapitalBufferCents: 1_000_000_000_000_00, // $1.0T < $2.0T
      stressTestSurvivalDays: 3650, // < 5475
    });

    expect(breach.isSolvent).toBe(false);
    expect(breach.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(breach.violations).toHaveLength(5);
  });

  it('applies cosmological haircuts correctly across various collateral asset tiers', () => {
    const bond = calculatePanGalacticCollateralValue(102_000_00, 'SOVEREIGN_BONDS');
    expect(bond.haircutFactor).toBe(1.02);
    expect(bond.netValuationCents).toBe(100_000_00);

    const gold = calculatePanGalacticCollateralValue(105_000_00, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.05);
    expect(gold.netValuationCents).toBe(100_000_00);

    const absoluteVacuumSingularity = calculatePanGalacticCollateralValue(135_000_00, 'ABSOLUTE_VACUUM_SINGULARITIES');
    expect(absoluteVacuumSingularity.haircutFactor).toBe(1.35);
    expect(absoluteVacuumSingularity.netValuationCents).toBe(100_000_00);
  });
});
