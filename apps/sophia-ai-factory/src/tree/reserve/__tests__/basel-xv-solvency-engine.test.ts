/**
 * @file basel-xv-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XV Omniverse Solvency Engine & $5.0 Trillion Multiverse Treasury Singularity.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateOmniverseCollateralValue,
  evaluateBaselXvSolvency,
} from '../basel-xv-solvency-engine';

describe('Basel XV Solvency & $5.0 Trillion Treasury Singularity Engine', () => {
  it('correctly calculates net haircut-adjusted collateral valuations', () => {
    // Sovereign bonds haircut factor = 1.02
    const bonds = calculateOmniverseCollateralValue(102_000_000_00, 'SOVEREIGN_BONDS');
    expect(bonds.haircutFactor).toBe(1.02);
    expect(bonds.netValuationCents).toBe(100_000_000_00);

    // Gold haircut factor = 1.05
    const gold = calculateOmniverseCollateralValue(105_000_000_00, 'PHYSICAL_GOLD');
    expect(gold.haircutFactor).toBe(1.05);
    expect(gold.netValuationCents).toBe(100_000_000_00);

    // Transcendental Vacuum Singularities haircut factor = 1.35
    const vacuum = calculateOmniverseCollateralValue(135_000_000_00, 'TRANSCENDENTAL_VACUUM_SINGULARITIES');
    expect(vacuum.haircutFactor).toBe(1.35);
    expect(vacuum.netValuationCents).toBe(100_000_000_00);
  });

  it('approves compliant sovereign treasury with Basel XV solvency & 20-year survival', () => {
    // Requirements: CET1 >= 42.00% (4200 bps), LCR >= 1200.00% (120000 bps), NSFR >= 450.00% (45000 bps)
    // Capital buffer >= $5.0T, Survival >= 7,300 days (20 years)
    const result = evaluateBaselXvSolvency({
      commonEquityTier1Cents: 450_000_000_000_00, // $450B
      totalRiskExposureCents: 1_000_000_000_000_00, // $1.0T -> 45.00% CET1 (4500 bps)
      highQualityLiquidAssetsCents: 150_000_000_000_00, // $150B
      netCashOutflows30DaysCents: 10_000_000_000_00, // $10B -> 1500% LCR (150,000 bps)
      availableStableFundingCents: 500_000_000_000_00, // $500B
      requiredStableFundingCents: 100_000_000_000_00, // $100B -> 500% NSFR (50,000 bps)
      sovereignCapitalBufferCents: 5_000_000_000_000_00, // $5.0T USD
      stressTestSurvivalDays: 7300, // 20 years
    });

    expect(result.isSolvent).toBe(true);
    expect(result.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(result.cet1RatioBps).toBe(4500); // 45.00% >= 42.00%
    expect(result.liquidityCoverageRatioBps).toBe(150000); // 1500% >= 1200%
    expect(result.netStableFundingRatioBps).toBe(50000); // 500% >= 450%
    expect(result.violations).toHaveLength(0);
    expect(result.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects violations and flags capital buffer or liquidity breaches', () => {
    // Insufficient CET1 (e.g. 30.00% < 42.00%) and short survival days
    const deficitResult = evaluateBaselXvSolvency({
      commonEquityTier1Cents: 300_000_000_000_00, // 30.00%
      totalRiskExposureCents: 1_000_000_000_000_00,
      highQualityLiquidAssetsCents: 50_000_000_000_00, // 500% < 1200%
      netCashOutflows30DaysCents: 10_000_000_000_00,
      availableStableFundingCents: 300_000_000_000_00, // 300% < 450%
      requiredStableFundingCents: 100_000_000_000_00,
      sovereignCapitalBufferCents: 2_000_000_000_000_00, // $2.0T < $5.0T
      stressTestSurvivalDays: 3650, // 10 years < 20 years
    });

    expect(deficitResult.isSolvent).toBe(false);
    expect(deficitResult.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(deficitResult.violations.length).toBeGreaterThanOrEqual(4);
    expect(deficitResult.violations.some((v) => v.includes('CET1 Ratio'))).toBe(true);
    expect(deficitResult.violations.some((v) => v.includes('Liquidity Coverage Ratio'))).toBe(true);
    expect(deficitResult.violations.some((v) => v.includes('Net Stable Funding Ratio'))).toBe(true);
    expect(deficitResult.violations.some((v) => v.includes('Sovereign capital buffer'))).toBe(true);
  });
});
