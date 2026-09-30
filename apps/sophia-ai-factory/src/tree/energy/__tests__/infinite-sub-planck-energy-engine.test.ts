/**
 * @file infinite-sub-planck-energy-engine.test.ts
 * @layer tree/energy/__tests__
 * @description Unit tests for Infinite Sub-Planck Power & Forty-Five-Nines (99.9999999999999999999999999999999999999999999%) SLA Guarantee.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateFortyFiveNinesSla,
  validateInfiniteSubPlanckPower,
} from '../infinite-sub-planck-energy-engine';

describe('Infinite Sub-Planck Energy & Forty-Five-Nines SLA Engine', () => {
  it('validates compliant Infinite harvest power with 0.0 carbon intensity and COP >= 120.0', () => {
    const output = validateInfiniteSubPlanckPower({
      powerSourceType: 'INFINITE_ZERO_POINT_HARVESTER',
      allocatedMegawatts: 10_000_000_000,
      carbonIntensityGPerKwh: 0.0,
      boseEinsteinCop: 125.0, // >= 120.0
      isNetZeroCertified: true,
    });

    expect(output.isCompliant).toBe(true);
    expect(output.violations).toHaveLength(0);
    expect(output.verificationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects power configurations that breach net-zero or minimum COP thresholds', () => {
    const invalid = validateInfiniteSubPlanckPower({
      powerSourceType: 'INFINITE_ZERO_POINT_HARVESTER',
      allocatedMegawatts: 0,
      carbonIntensityGPerKwh: 0.05, // > 0.0
      boseEinsteinCop: 100.0, // < 120.0
      isNetZeroCertified: false,
    });

    expect(invalid.isCompliant).toBe(false);
    expect(invalid.violations.length).toBeGreaterThanOrEqual(4);
    expect(invalid.violations.some((v) => v.includes('violates absolute net-zero'))).toBe(true);
    expect(invalid.violations.some((v) => v.includes('below minimum requirement'))).toBe(true);
    expect(invalid.violations.some((v) => v.includes('strictly positive'))).toBe(true);
    expect(invalid.violations.some((v) => v.includes('must be certified net-zero'))).toBe(true);
  });

  it('certifies Forty-Five-Nines continuous SLA when downtime is within 0.000000000000000000002592 ns budget', () => {
    const audit = evaluateFortyFiveNinesSla({
      actualDowntimeNanoseconds: 0.0000000000000000000020, // < 0.000000000000000000002592 ns
      infiniteFoamSingularityActive: true,
      bftQuorumConsensusPct: 99.99999999, // >= 99.99999999%
    });

    expect(audit.slaVerdict).toBe('FORTY_FIVE_NINES_CERTIFIED');
    expect(audit.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.99999999999);
    expect(audit.violations).toHaveLength(0);
    expect(audit.auditSignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('triggers breach and liquidity penalty when downtime exceeds allowable budget or singularity drops', () => {
    const breach = evaluateFortyFiveNinesSla({
      actualDowntimeNanoseconds: 0.0000000000000000000050, // Exceeds budget
      infiniteFoamSingularityActive: false,
      bftQuorumConsensusPct: 98.5, // Below 99.99999999%
    });

    expect(breach.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
    expect(breach.violations.length).toBeGreaterThanOrEqual(3);
    expect(breach.violations.some((v) => v.includes('exceeds allowable Forty-Five-Nines budget'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('singularity mesh link is degraded'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('below required 99.99999999% threshold'))).toBe(true);
  });
});
