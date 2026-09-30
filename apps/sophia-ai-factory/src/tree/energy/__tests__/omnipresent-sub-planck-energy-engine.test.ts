/**
 * @file omnipresent-sub-planck-energy-engine.test.ts
 * @layer tree/energy/__tests__
 * @description Unit tests for Omnipresent Sub-Planck Power & Forty-Two-Nines (99.9999999999999999999999999999999999999999%) SLA Guarantee.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateFortyTwoNinesSla,
  validateOmnipresentSubPlanckPower,
} from '../omnipresent-sub-planck-energy-engine';

describe('Omnipresent Sub-Planck Energy & Forty-Two-Nines SLA Engine', () => {
  it('validates compliant Omnipresent harvest power with 0.0 carbon intensity and COP >= 100.0', () => {
    const output = validateOmnipresentSubPlanckPower({
      powerSourceType: 'OMNIPRESENT_ZERO_POINT_HARVESTER',
      allocatedMegawatts: 5_000_000_000,
      carbonIntensityGPerKwh: 0.0,
      boseEinsteinCop: 105.0, // >= 100.0
      isNetZeroCertified: true,
    });

    expect(output.isCompliant).toBe(true);
    expect(output.violations).toHaveLength(0);
    expect(output.verificationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects power configurations that breach net-zero or minimum COP thresholds', () => {
    const invalid = validateOmnipresentSubPlanckPower({
      powerSourceType: 'OMNIPRESENT_ZERO_POINT_HARVESTER',
      allocatedMegawatts: 0,
      carbonIntensityGPerKwh: 0.05, // > 0.0
      boseEinsteinCop: 80.0, // < 100.0
      isNetZeroCertified: false,
    });

    expect(invalid.isCompliant).toBe(false);
    expect(invalid.violations.length).toBeGreaterThanOrEqual(4);
    expect(invalid.violations.some((v) => v.includes('violates absolute net-zero'))).toBe(true);
    expect(invalid.violations.some((v) => v.includes('below minimum requirement'))).toBe(true);
    expect(invalid.violations.some((v) => v.includes('strictly positive'))).toBe(true);
    expect(invalid.violations.some((v) => v.includes('must be certified net-zero'))).toBe(true);
  });

  it('certifies Forty-Two-Nines continuous SLA when downtime is within 0.0000000000000000002592 ns budget', () => {
    const audit = evaluateFortyTwoNinesSla({
      actualDowntimeNanoseconds: 0.00000000000000000020, // < 0.0000000000000000002592 ns
      omnipresentFoamSingularityActive: true,
      bftQuorumConsensusPct: 99.9999999, // >= 99.9999999%
    });

    expect(audit.slaVerdict).toBe('FORTY_TWO_NINES_CERTIFIED');
    expect(audit.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.99999999999);
    expect(audit.violations).toHaveLength(0);
    expect(audit.auditSignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('triggers breach and liquidity penalty when downtime exceeds allowable budget or singularity drops', () => {
    const breach = evaluateFortyTwoNinesSla({
      actualDowntimeNanoseconds: 0.00000000000000000050, // Exceeds budget
      omnipresentFoamSingularityActive: false,
      bftQuorumConsensusPct: 98.5, // Below 99.9999999%
    });

    expect(breach.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
    expect(breach.violations.length).toBeGreaterThanOrEqual(3);
    expect(breach.violations.some((v) => v.includes('exceeds allowable Forty-Two-Nines budget'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('singularity mesh link is degraded'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('below required 99.9999999% threshold'))).toBe(true);
  });
});
