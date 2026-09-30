/**
 * @file basel-xxv-solvency-engine.test.ts
 * @layer tree/reserve/__tests__
 * @description Unit tests for Basel XXV Deca-Quadrillion Solvency Engine & $10.0 Quadrillion Sovereign Reserve Singularity.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateDecaquadrillionCollateralValue,
  evaluateBaselXxvSolvency,
} from '../basel-xxv-solvency-engine';

describe('Basel XXV Solvency & $10.0Q Reserve Singularity Engine', () => {
  it('certifies full Basel XXV solvency and capital buffer with 1,500,000-day survival horizon', () => {
    const audit = evaluateBaselXxvSolvency({
      commonEquityTier1Cents: 950_000_000_000_000,
      totalRiskExposureCents: 1_000_000_000_000_000, // CET1 = 95.00% (9500 bps >= 9000 bps)
      highQualityLiquidAssetsCents: 1_200_000_000_000_000,
      netCashOutflows30DaysCents: 10_000_000_000_000, // LCR = 12000.00% (1200000 bps >= 1000000 bps)
      availableStableFundingCents: 3_000_000_000_000_000,
      requiredStableFundingCents: 100_000_000_000_000, // NSFR = 3000.00% (300000 bps >= 250000 bps)
      sovereignCapitalBufferCents: 1_000_000_000_000_000_000, // $10.0Q (10^18 cents)
      stressTestSurvivalDays: 1_500_000, // 4,110 years
    });

    expect(audit.isSolvent).toBe(true);
    expect(audit.solvencyStatus).toBe('SOLVENT_AND_CAPITALIZED');
    expect(audit.cet1RatioBps).toBe(9500);
    expect(audit.liquidityCoverageRatioBps).toBe(1200000);
    expect(audit.netStableFundingRatioBps).toBe(300000);
    expect(audit.violations.length).toBe(0);
    expect(audit.supervisorySignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects violations if capital buffer or survival horizon is insufficient', () => {
    const deficitAudit = evaluateBaselXxvSolvency({
      commonEquityTier1Cents: 500_000_000_000_000,
      totalRiskExposureCents: 1_000_000_000_000_000, // CET1 = 50.00% < 90.00%
      highQualityLiquidAssetsCents: 100_000_000_000_000,
      netCashOutflows30DaysCents: 100_000_000_000_000, // LCR = 100.00% < 10000.00%
      availableStableFundingCents: 100_000_000_000_000,
      requiredStableFundingCents: 100_000_000_000_000, // NSFR = 100.00% < 2500.00%
      sovereignCapitalBufferCents: 500_000_000_000_000_000, // $5.0Q < $10.0Q requirement
      stressTestSurvivalDays: 500_000, // < 1,500,000 days
    });

    expect(deficitAudit.isSolvent).toBe(false);
    expect(deficitAudit.solvencyStatus).toBe('CAPITAL_BUFFER_BREACH');
    expect(deficitAudit.violations.length).toBe(5);
  });

  it('applies calibrated haircut factors for Deca-Quadrillion sovereign reserve assets with BigInt precision', () => {
    const goldValuation = calculateDecaquadrillionCollateralValue(1_030_000_00, 'PHYSICAL_GOLD');
    expect(goldValuation.haircutFactor).toBe(1.03);
    expect(goldValuation.netValuationCents).toBe(1_000_000_00);

    const foamValuation = calculateDecaquadrillionCollateralValue(
      1_300_000_000_000_000_000, // $13.0Q
      'DECAQUADRILLION_SUB_PLANCK_FOAM'
    );
    expect(foamValuation.haircutFactor).toBe(1.30);
    expect(foamValuation.netValuationCents).toBe(1_000_000_000_000_000_000); // Exactly $10.0Q
  });
});
