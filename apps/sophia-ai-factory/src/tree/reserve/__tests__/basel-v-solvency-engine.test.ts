/**
 * @file basel-v-solvency-engine.test.ts
 * @description Unit tests for Basel V solvency and collateral haircuts engine.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateOmniversalCollateralValue,
  evaluateBaselVSolvency,
} from '../basel-v-solvency-engine';

describe('Basel V Solvency & Collateral Engine', () => {
  it('1. Calculates risk-weighted haircuts across multi-asset collateral types', () => {
    const bonds = calculateOmniversalCollateralValue(100_000_000_00, 'SOVEREIGN_BONDS');
    expect(bonds.haircutFactor).toBe(1.05);
    expect(bonds.netValuationCents).toBe(Math.floor(100_000_000_00 / 1.05));

    const gold = calculateOmniversalCollateralValue(100_000_000_00, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.15);

    const ssdr = calculateOmniversalCollateralValue(100_000_000_00, 'SSDR_BASKET');
    expect(ssdr.haircutFactor).toBe(1.25);

    const equities = calculateOmniversalCollateralValue(100_000_000_00, 'TIER_1_EQUITIES');
    expect(equities.haircutFactor).toBe(1.50);

    const geac = calculateOmniversalCollateralValue(100_000_000_00, 'GEAC_COMPUTE_CREDITS');
    expect(geac.haircutFactor).toBe(1.75);
  });

  it('2. Certifies solvent institution meeting all Basel V metrics and $2.5B buffer', () => {
    const result = evaluateBaselVSolvency({
      commonEquityTier1Cents: 200_000_000_00, // $200M
      totalRiskExposureCents: 1_000_000_000_00, // $1B -> 20.00% CET1
      highQualityLiquidAssetsCents: 300_000_000_00,
      netCashOutflows30DaysCents: 100_000_000_00, // 300% LCR
      availableStableFundingCents: 150_000_000_00,
      requiredStableFundingCents: 100_000_000_00, // 150% NSFR
      totalLiquidityBufferCents: 250_000_000_000, // $2.5B
      stressTestSurvivalDays: 120, // 120 days
    });

    expect(result.isSolvent).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.cet1RatioBps).toBe(2000); // 20.00% >= 18.00%
    expect(result.liquidityCoverageRatioBps).toBe(30000); // 300.00% >= 250.00%
    expect(result.netStableFundingRatioBps).toBe(15000); // 150.00% >= 135.00%
    expect(result.supervisorySignature).toHaveLength(64);
  });

  it('3. Rejects solvency when CET1 or liquidity buffer falls below sovereign minimums', () => {
    const insolventResult = evaluateBaselVSolvency({
      commonEquityTier1Cents: 150_000_000_00, // 15% CET1 (below 18%)
      totalRiskExposureCents: 1_000_000_000_00,
      highQualityLiquidAssetsCents: 200_000_000_00, // 200% LCR (below 250%)
      netCashOutflows30DaysCents: 100_000_000_00,
      availableStableFundingCents: 120_000_000_00, // 120% NSFR (below 135%)
      requiredStableFundingCents: 100_000_000_00,
      totalLiquidityBufferCents: 200_000_000_000, // $2.0B (below $2.5B)
      stressTestSurvivalDays: 60, // 60 days (below 90 days)
    });

    expect(insolventResult.isSolvent).toBe(false);
    expect(insolventResult.violations.length).toBeGreaterThanOrEqual(4);
  });
});
