/**
 * @file basel-xxvi-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XXVI Viginti-Quadrillion Solvency Engine & $20.0 Quadrillion Sovereign Reserve Singularity.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateVigintiquadrillionCollateralValue,
  evaluateBaselXxviSolvency,
} from '../basel-xxvi-solvency-engine';

describe('Basel XXVI Solvency & $20.0Q Reserve Singularity Engine', () => {
  it('certifies full Basel XXVI solvency and capital buffer with 2,000,000-day survival horizon', () => {
    const audit = evaluateBaselXxviSolvency({
      commonEquityTier1Cents: 950_000_000_000_000,
      totalRiskExposureCents: 1_000_000_000_000_000, // CET1 = 95.00% (9500 bps >= 9200 bps)
      highQualityLiquidAssetsCents: 1_500_000_000_000_000,
      netCashOutflows30DaysCents: 10_000_000_000_000, // LCR = 15000.00% (1500000 bps >= 1200000 bps)
      availableStableFundingCents: 4_000_000_000_000_000,
      requiredStableFundingCents: 100_000_000_000_000, // NSFR = 4000.00% (400000 bps >= 300000 bps)
      sovereignCapitalBufferCents: 2_000_000_000_000_000_000, // $20.0Q (2*10^18 cents)
      stressTestSurvivalDays: 2_000_000, // 5,479 years
    });

    expect(audit.isSolvent).toBe(true);
    expect(audit.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(audit.cet1RatioBps).toBe(9500);
    expect(audit.liquidityCoverageRatioBps).toBe(1500000);
    expect(audit.netStableFundingRatioBps).toBe(400000);
    expect(audit.violations.length).toBe(0);
    expect(audit.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects violations if capital buffer or survival horizon is insufficient', () => {
    const deficitAudit = evaluateBaselXxviSolvency({
      commonEquityTier1Cents: 500_000_000_000_000,
      totalRiskExposureCents: 1_000_000_000_000_000, // CET1 = 50.00% < 92.00%
      highQualityLiquidAssetsCents: 100_000_000_000_000,
      netCashOutflows30DaysCents: 100_000_000_000_000, // LCR = 100.00% < 12000.00%
      availableStableFundingCents: 100_000_000_000_000,
      requiredStableFundingCents: 100_000_000_000_000, // NSFR = 100.00% < 3000.00%
      sovereignCapitalBufferCents: 1_000_000_000_000_000_000, // $10.0Q < $20.0Q requirement
      stressTestSurvivalDays: 1_000_000, // < 2,000,000 days
    });

    expect(deficitAudit.isSolvent).toBe(false);
    expect(deficitAudit.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(deficitAudit.violations.length).toBe(5);
  });

  it('applies calibrated haircut factors for Viginti-Quadrillion sovereign reserve assets with BigInt precision', () => {
    const goldValuation = calculateVigintiquadrillionCollateralValue(1_025_000_00, 'PHYSICAL_GOLD');
    expect(goldValuation.haircutFactor).toBe(1.025);
    expect(goldValuation.netValuationCents).toBe(1_000_000_00);

    const foamValuation = calculateVigintiquadrillionCollateralValue(
      2_500_000_000_000_000_000, // $25.0Q
      'VIGINTIQUADRILLION_SUB_PLANCK_FOAM'
    );
    expect(foamValuation.haircutFactor).toBe(1.25);
    expect(foamValuation.netValuationCents).toBe(2_000_000_000_000_000_000); // Exactly $20.0Q
  });
});
