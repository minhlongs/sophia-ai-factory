/**
 * @file biquadrillion-sub-planck-energy-engine.test.ts
 * @layer tree/energy/__tests__
 * @description Unit tests for Bi-Quadrillion Sub-Planck Power & Fifty-One-Nines (99.999999999999999999999999999999999999999999999999999%) SLA Guarantee.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateFiftyOneNinesSla,
  validateBiquadrillionSubPlanckPower,
} from '../biquadrillion-sub-planck-energy-engine';

describe('Bi-Quadrillion Sub-Planck Energy & Fifty-One-Nines SLA Engine', () => {
  it('validates compliant Bi-Quadrillion harvest power with 0.0 carbon intensity and COP >= 180.0', () => {
    const output = validateBiquadrillionSubPlanckPower({
      powerSourceType: 'BIQUADRILLION_ZERO_POINT_HARVESTER',
      allocatedMegawatts: 40_000_000_000,
      carbonIntensityGPerKwh: 0.0,
      boseEinsteinCop: 195.0, // >= 180.0
      isNetZeroCertified: true,
    });

    expect(output.isCompliant).toBe(true);
    expect(output.violations).toHaveLength(0);
    expect(output.verificationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects power configurations that breach net-zero or minimum COP thresholds', () => {
    const invalid = validateBiquadrillionSubPlanckPower({
      powerSourceType: 'BIQUADRILLION_ZERO_POINT_HARVESTER',
      allocatedMegawatts: 0,
      carbonIntensityGPerKwh: 0.05, // > 0.0
      boseEinsteinCop: 150.0, // < 180.0
      isNetZeroCertified: false,
    });

    expect(invalid.isCompliant).toBe(false);
    expect(invalid.violations.length).toBeGreaterThanOrEqual(4);
    expect(invalid.violations.some((v) => v.includes('violates absolute net-zero'))).toBe(true);
    expect(invalid.violations.some((v) => v.includes('below minimum requirement'))).toBe(true);
    expect(invalid.violations.some((v) => v.includes('strictly positive'))).toBe(true);
    expect(invalid.violations.some((v) => v.includes('must be certified net-zero'))).toBe(true);
  });

  it('certifies Fifty-One-Nines continuous SLA when downtime is within 0.00000000000000000000000002592 ns budget', () => {
    const audit = evaluateFiftyOneNinesSla({
      actualDowntimeNanoseconds: 0.000000000000000000000000020, // < 0.00000000000000000000000002592 ns
      biquadrillionFoamSingularityActive: true,
      bftQuorumConsensusPct: 99.9999999999, // >= 99.9999999999%
    });

    expect(audit.slaVerdict).toBe('FIFTY_ONE_NINES_CERTIFIED');
    expect(audit.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.99999999999);
    expect(audit.violations).toHaveLength(0);
    expect(audit.auditSignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('triggers breach and liquidity penalty when downtime exceeds allowable budget or singularity drops', () => {
    const breach = evaluateFiftyOneNinesSla({
      actualDowntimeNanoseconds: 0.000000000000000000000000050, // Exceeds budget
      biquadrillionFoamSingularityActive: false,
      bftQuorumConsensusPct: 98.5, // Below 99.9999999999%
    });

    expect(breach.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
    expect(breach.violations.length).toBeGreaterThanOrEqual(3);
    expect(breach.violations.some((v) => v.includes('exceeds allowable Fifty-One-Nines budget'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('singularity mesh link is degraded'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('below required 99.9999999999% threshold'))).toBe(true);
  });
});
