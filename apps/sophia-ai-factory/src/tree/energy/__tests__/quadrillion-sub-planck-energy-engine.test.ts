/**
 * @file quadrillion-sub-planck-energy-engine.test.ts
 * @layer tree/energy/__tests__
 * @description Unit tests for Quadrillion Sub-Planck Power & Forty-Eight-Nines (99.9999999999999999999999999999999999999999999999%) SLA Guarantee.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateFortyEightNinesSla,
  validateQuadrillionSubPlanckPower,
} from '../quadrillion-sub-planck-energy-engine';

describe('Quadrillion Sub-Planck Energy & Forty-Eight-Nines SLA Engine', () => {
  it('validates compliant Quadrillion harvest power with 0.0 carbon intensity and COP >= 150.0', () => {
    const output = validateQuadrillionSubPlanckPower({
      powerSourceType: 'QUADRILLION_ZERO_POINT_HARVESTER',
      allocatedMegawatts: 20_000_000_000,
      carbonIntensityGPerKwh: 0.0,
      boseEinsteinCop: 160.0, // >= 150.0
      isNetZeroCertified: true,
    });

    expect(output.isCompliant).toBe(true);
    expect(output.violations).toHaveLength(0);
    expect(output.verificationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects power configurations that breach net-zero or minimum COP thresholds', () => {
    const invalid = validateQuadrillionSubPlanckPower({
      powerSourceType: 'QUADRILLION_ZERO_POINT_HARVESTER',
      allocatedMegawatts: 0,
      carbonIntensityGPerKwh: 0.05, // > 0.0
      boseEinsteinCop: 120.0, // < 150.0
      isNetZeroCertified: false,
    });

    expect(invalid.isCompliant).toBe(false);
    expect(invalid.violations.length).toBeGreaterThanOrEqual(4);
    expect(invalid.violations.some((v) => v.includes('violates absolute net-zero'))).toBe(true);
    expect(invalid.violations.some((v) => v.includes('below minimum requirement'))).toBe(true);
    expect(invalid.violations.some((v) => v.includes('strictly positive'))).toBe(true);
    expect(invalid.violations.some((v) => v.includes('must be certified net-zero'))).toBe(true);
  });

  it('certifies Forty-Eight-Nines continuous SLA when downtime is within 0.00000000000000000000002592 ns budget', () => {
    const audit = evaluateFortyEightNinesSla({
      actualDowntimeNanoseconds: 0.000000000000000000000020, // < 0.00000000000000000000002592 ns
      quadrillionFoamSingularityActive: true,
      bftQuorumConsensusPct: 99.999999999, // >= 99.999999999%
    });

    expect(audit.slaVerdict).toBe('FORTY_EIGHT_NINES_CERTIFIED');
    expect(audit.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.99999999999);
    expect(audit.violations).toHaveLength(0);
    expect(audit.auditSignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('triggers breach and liquidity penalty when downtime exceeds allowable budget or singularity drops', () => {
    const breach = evaluateFortyEightNinesSla({
      actualDowntimeNanoseconds: 0.000000000000000000000050, // Exceeds budget
      quadrillionFoamSingularityActive: false,
      bftQuorumConsensusPct: 98.5, // Below 99.999999999%
    });

    expect(breach.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
    expect(breach.violations.length).toBeGreaterThanOrEqual(3);
    expect(breach.violations.some((v) => v.includes('exceeds allowable Forty-Eight-Nines budget'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('singularity mesh link is degraded'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('below required 99.999999999% threshold'))).toBe(true);
  });
});
