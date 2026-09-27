/**
 * @file basel-vi-solvency-engine.test.ts
 * @description Unit tests for Basel VI solvency and universal collateral haircuts.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateUniversalCollateralValue,
  evaluateBaselViSolvency,
} from '../basel-vi-solvency-engine';

describe('Basel VI Extreme Solvency & Collateral Engine', () => {
  it('1. Calculates risk-weighted haircuts across universal collateral types', () => {
    const bonds = calculateUniversalCollateralValue(100_000_000_00, 'SOVEREIGN_BONDS');
    expect(bonds.haircutFactor).toBe(1.03);
    expect(bonds.netValuationCents).toBe(Math.floor(100_000_000_00 / 1.03));

    const gold = calculateUniversalCollateralValue(100_000_000_00, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.10);

    const ssdr = calculateUniversalCollateralValue(100_000_000_00, 'SSDR_BASKET');
    expect(ssdr.haircutFactor).toBe(1.20);

    const equities = calculateUniversalCollateralValue(100_000_000_00, 'TIER_1_EQUITIES');
    expect(equities.haircutFactor).toBe(1.40);

    const ksce = calculateUniversalCollateralValue(100_000_000_00, 'KSCE_STELLAR_CREDITS');
    expect(ksce.haircutFactor).toBe(1.60);
  });

  it('2. Certifies solvency for institutions meeting all Basel VI metrics and $5.0B buffer', () => {
    const result = evaluateBaselViSolvency({
      commonEquityTier1Cents: 500_000_000_00, // $500M
      totalRiskExposureCents: 2_000_000_000_00, // $2.0B -> 25.00% CET1 >= 20.00%
      highQualityLiquidAssetsCents: 700_000_000_00,
      netCashOutflows30DaysCents: 200_000_000_00, // 350% LCR >= 300%
      availableStableFundingCents: 350_000_000_00,
      requiredStableFundingCents: 200_000_000_00, // 175% NSFR >= 150%
      totalLiquidityBufferCents: 500_000_000_000, // $5.0B in cents
      stressTestSurvivalDays: 180, // 180 days >= 120 days
    });

    expect(result.isSolvent).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.cet1RatioBps).toBe(2500); // 25.00%
    expect(result.liquidityCoverageRatioBps).toBe(35000); // 350.00%
    expect(result.netStableFundingRatioBps).toBe(17500); // 175.00%
    expect(result.supervisorySignature).toHaveLength(64);
  });

  it('3. Rejects solvency when CET1 or liquidity buffer falls below Basel VI standards', () => {
    const insolvent = evaluateBaselViSolvency({
      commonEquityTier1Cents: 150_000_000_00, // 15% CET1 (below 20%)
      totalRiskExposureCents: 1_000_000_000_00,
      highQualityLiquidAssetsCents: 250_000_000_00, // 250% LCR (below 300%)
      netCashOutflows30DaysCents: 100_000_000_00,
      availableStableFundingCents: 140_000_000_00, // 140% NSFR (below 150%)
      requiredStableFundingCents: 100_000_000_00,
      totalLiquidityBufferCents: 400_000_000_000, // $4.0B (below $5.0B)
      stressTestSurvivalDays: 90, // 90 days (below 120 days)
    });

    expect(insolvent.isSolvent).toBe(false);
    expect(insolvent.violations.length).toBeGreaterThanOrEqual(4);
  });
});
