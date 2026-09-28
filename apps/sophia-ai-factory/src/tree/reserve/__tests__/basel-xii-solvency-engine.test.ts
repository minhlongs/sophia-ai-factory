/**
 * @file basel-xii-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XII Omnipresent Solvency & $500.0B Multiverse Reserve Singularity.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateMultiverseCollateralValue,
  evaluateBaselXiiSolvency,
} from '../basel-xii-solvency-engine';

describe('Basel XII Solvency & $500.0B Multiverse Reserve Singularity Engine', () => {
  it('certifies full Basel XII solvency under standard Gate 22 conditions (CET1 >= 35%, LCR >= 800%, NSFR >= 300%, Buffer >= $500B)', () => {
    const result = evaluateBaselXiiSolvency({
      commonEquityTier1Cents: 200_000_000_000_00, // $200.0B
      totalRiskExposureCents: 500_000_000_000_00, // $500.0B -> CET1 = 40.00% (4000 bps)
      highQualityLiquidAssetsCents: 180_000_000_000_00, // $180.0B
      netCashOutflows30DaysCents: 20_000_000_000_00, // $20.0B -> LCR = 900.00% (90000 bps)
      availableStableFundingCents: 180_000_000_000_00, // $180.0B
      requiredStableFundingCents: 50_000_000_000_00, // $50.0B -> NSFR = 360.00% (36000 bps)
      sovereignCapitalBufferCents: 500_000_000_000_00, // $500.0B
      stressTestSurvivalDays: 2555, // 7 years
    });

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.cet1RatioBps).toBe(4000);
    expect(result.liquidityCoverageRatioBps).toBe(90000);
    expect(result.netStableFundingRatioBps).toBe(36000);
    expect(result.violations).toHaveLength(0);
    expect(result.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects solvency breaches when CET1, LCR, or capital buffer is inadequate', () => {
    const deficient = evaluateBaselXiiSolvency({
      commonEquityTier1Cents: 100_000_000_000_00, // $100B
      totalRiskExposureCents: 500_000_000_000_00, // CET1 = 20.00% (< 35.00%)
      highQualityLiquidAssetsCents: 70_000_000_000_00,
      netCashOutflows30DaysCents: 20_000_000_000_00, // LCR = 350.00% (< 800.00%)
      availableStableFundingCents: 100_000_000_000_00,
      requiredStableFundingCents: 50_000_000_000_00, // NSFR = 200.00% (< 300.00%)
      sovereignCapitalBufferCents: 300_000_000_000_00, // $300B (< $500.0B)
      stressTestSurvivalDays: 730, // 2 years (< 2,555 days)
    });

    expect(deficient.isSolvent).toBe(false);
    expect(deficient.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(deficient.violations.length).toBeGreaterThanOrEqual(4);
    expect(deficient.violations.some((v) => v.includes('CET1 Ratio'))).toBe(true);
    expect(deficient.violations.some((v) => v.includes('Liquidity Coverage Ratio'))).toBe(true);
    expect(deficient.violations.some((v) => v.includes('2,555 days'))).toBe(true);
  });

  it('calculates proper haircut haircuts for multiverse collateral assets', () => {
    const gold = calculateMultiverseCollateralValue(105_000_00, 'PHYSICAL_GOLD'); // haircut 1.05
    expect(gold.haircutFactor).toBe(1.05);
    expect(gold.netValuationCents).toBe(100_000_00);

    const subPlanck = calculateMultiverseCollateralValue(135_000_00, 'SUB_PLANCK_VACUUM_SINGULARITIES'); // haircut 1.35
    expect(subPlanck.haircutFactor).toBe(1.35);
    expect(subPlanck.netValuationCents).toBe(100_000_00);
  });
});
