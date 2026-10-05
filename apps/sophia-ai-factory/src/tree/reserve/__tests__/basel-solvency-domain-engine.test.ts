/**
 * @file basel-solvency-domain-engine.test.ts
 * @layer tree/reserve
 * @description Unit tests for canonical Basel Solvency Domain Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateParameterizedCollateralValue,
  evaluateParameterizedBaselSolvency,
} from '../basel-solvency-domain-engine';

describe('BaselSolvencyDomainEngine (Canonical Parameterized Reserve Engine)', () => {
  it('calculates haircut-adjusted collateral value accurately', () => {
    const haircuts = {
      SOVEREIGN_BONDS: 1.05,
      PHYSICAL_GOLD: 1.15,
      TIER_1_EQUITIES: 1.50,
    };

    const result = calculateParameterizedCollateralValue(105_000, 'SOVEREIGN_BONDS', haircuts);
    expect(result.nominalValueCents).toBe(105_000);
    expect(result.haircutFactor).toBe(1.05);
    expect(result.netValuationCents).toBe(100_000);
  });

  it('evaluates fully compliant Basel solvency input as solvent', () => {
    const result = evaluateParameterizedBaselSolvency(
      {
        commonEquityTier1Cents: 15_000_000_00,
        totalRiskExposureCents: 40_000_000_00, // CET1 = 37.5%
        highQualityLiquidAssetsCents: 150_000_000_00,
        netCashOutflows30DaysCents: 20_000_000_00, // LCR = 750%
        availableStableFundingCents: 100_000_000_00,
        requiredStableFundingCents: 40_000_000_00, // NSFR = 250%
        sovereignCapitalBufferCents: 100_000_000_00,
        stressTestSurvivalDays: 365,
      },
      {
        minCet1RatioBps: 1800,
        minLcrBps: 25000,
        minNsfrBps: 13500,
        minSovereignBufferCents: 50_000_000_00,
        minStressSurvivalDays: 90,
      }
    );

    expect(result.isSolvent).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.cet1RatioBps).toBe(3750);
    expect(result.liquidityCoverageRatioBps).toBe(75000);
    expect(result.netStableFundingRatioBps).toBe(25000);
    expect(result.supervisorySignature).toHaveLength(64);
  });

  it('detects violations and flags insolvency when CET1 or LCR falls below target', () => {
    const result = evaluateParameterizedBaselSolvency(
      {
        commonEquityTier1Cents: 1_000_000_00,
        totalRiskExposureCents: 100_000_000_00, // CET1 = 1% < 18%
        highQualityLiquidAssetsCents: 1_000_000_00,
        netCashOutflows30DaysCents: 100_000_000_00, // LCR = 1% < 250%
        availableStableFundingCents: 10_000_000_00,
        requiredStableFundingCents: 10_000_000_00,
        sovereignCapitalBufferCents: 10_000_00,
        stressTestSurvivalDays: 10,
      },
      {
        minCet1RatioBps: 1800,
        minLcrBps: 25000,
        minNsfrBps: 13500,
        minSovereignBufferCents: 100_000_000_00,
        minStressSurvivalDays: 90,
      }
    );

    expect(result.isSolvent).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
  });
});
