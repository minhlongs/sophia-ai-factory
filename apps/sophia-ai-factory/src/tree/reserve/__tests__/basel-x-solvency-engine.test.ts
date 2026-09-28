/**
 * @file basel-x-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel X Pan-Cosmic Solvency & $100.0B Sovereign Reserve Grid.
 */

import { describe, expect, it } from 'vitest';
import {
  calculatePanCosmicCollateralValue,
  evaluateBaselXSolvency,
} from '../basel-x-solvency-engine';
import { GATE_20_SCALE_TARGETS } from '@/seed/types/trans-omniverse-rtgs-capital';

describe('Basel X Solvency Engine', () => {
  it('certifies capital adequacy and solvency under Basel X standards (CET1 ≥ 30%, LCR ≥ 600%, NSFR ≥ 220%, $100.0B buffer)', () => {
    const result = evaluateBaselXSolvency({
      commonEquityTier1Cents: 15_000_000_000_00, // $150B
      totalRiskExposureCents: 40_000_000_000_00, // $400B -> CET1 = 37.50% (>= 30.00%)
      highQualityLiquidAssetsCents: 120_000_000_000_00, // $1.2T
      netCashOutflows30DaysCents: 18_000_000_000_00, // $180B -> LCR = 666.66% (>= 600.00%)
      availableStableFundingCents: 100_000_000_000_00, // $1.0T
      requiredStableFundingCents: 40_000_000_000_00, // $400B -> NSFR = 250.00% (>= 220.00%)
      sovereignCapitalBufferCents: 100_000_000_000_00, // $100.0B
      stressTestSurvivalDays: 1095, // 3 years
    });

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.violations).toHaveLength(0);
    expect(result.cet1RatioBps).toBeGreaterThanOrEqual(GATE_20_SCALE_TARGETS.BASEL_X_MIN_CET1_BPS);
    expect(result.liquidityCoverageRatioBps).toBeGreaterThanOrEqual(GATE_20_SCALE_TARGETS.BASEL_X_MIN_LCR_BPS);
    expect(result.netStableFundingRatioBps).toBeGreaterThanOrEqual(GATE_20_SCALE_TARGETS.BASEL_X_MIN_NSFR_BPS);
    expect(result.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects solvency breaches when capital buffer falls below $100.0B or ratios degrade', () => {
    const result = evaluateBaselXSolvency({
      commonEquityTier1Cents: 5_000_000_000_00, // CET1 = 12.5% < 30%
      totalRiskExposureCents: 40_000_000_000_00,
      highQualityLiquidAssetsCents: 40_000_000_000_00, // LCR = 222% < 600%
      netCashOutflows30DaysCents: 18_000_000_000_00,
      availableStableFundingCents: 50_000_000_000_00, // NSFR = 125% < 220%
      requiredStableFundingCents: 40_000_000_000_00,
      sovereignCapitalBufferCents: 50_000_000_000_00, // $50B < $100B
      stressTestSurvivalDays: 365, // < 1,095 days
    });

    expect(result.isSolvent).toBe(false);
    expect(result.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(result.violations.length).toBeGreaterThanOrEqual(4);
  });

  it('calculates net haircut-adjusted valuation across Pan-Cosmic collateral assets', () => {
    const bondsVal = calculatePanCosmicCollateralValue(204_000_000, 'SOVEREIGN_BONDS');
    expect(bondsVal.netValuationCents).toBe(200_000_000); // 1.02 factor

    const goldVal = calculatePanCosmicCollateralValue(105_000_000, 'PHYSICAL_GOLD');
    expect(goldVal.netValuationCents).toBe(100_000_000); // 1.05 factor
  });
});
