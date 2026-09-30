/**
 * @file pentaquadrillion-sub-planck-energy-engine.test.ts
 * @layer tree/energy/__tests__
 * @description Unit tests for Penta-Quadrillion Sub-Planck Power & Fifty-Four-Nines (99.999999999999999999999999999999999999999999999999999999%) SLA Guarantee.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateFiftyFourNinesSla,
  validatePentaquadrillionSubPlanckPower,
} from '../pentaquadrillion-sub-planck-energy-engine';

describe('Penta-Quadrillion Sub-Planck Energy & Fifty-Four-Nines SLA Engine', () => {
  it('validates compliant Penta-Quadrillion harvest power with 0.0 carbon intensity and COP >= 220.0', () => {
    const output = validatePentaquadrillionSubPlanckPower({
      powerSourceType: 'PENTAQUADRILLION_ZERO_POINT_HARVESTER',
      allocatedMegawatts: 100_000_000_000,
      carbonIntensityGPerKwh: 0.0,
      boseEinsteinCop: 240.0, // >= 220.0
      isNetZeroCertified: true,
    });

    expect(output.isCompliant).toBe(true);
    expect(output.violations).toHaveLength(0);
    expect(output.verificationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects power configurations that breach net-zero or minimum COP thresholds', () => {
    const invalid = validatePentaquadrillionSubPlanckPower({
      powerSourceType: 'PENTAQUADRILLION_ZERO_POINT_HARVESTER',
      allocatedMegawatts: 0,
      carbonIntensityGPerKwh: 0.05, // > 0.0
      boseEinsteinCop: 180.0, // < 220.0
      isNetZeroCertified: false,
    });

    expect(invalid.isCompliant).toBe(false);
    expect(invalid.violations.length).toBeGreaterThanOrEqual(4);
    expect(invalid.violations.some((v) => v.includes('violates absolute net-zero'))).toBe(true);
    expect(invalid.violations.some((v) => v.includes('below minimum requirement'))).toBe(true);
    expect(invalid.violations.some((v) => v.includes('strictly positive'))).toBe(true);
    expect(invalid.violations.some((v) => v.includes('must be certified net-zero'))).toBe(true);
  });

  it('certifies Fifty-Four-Nines continuous SLA when downtime is within budget', () => {
    const audit = evaluateFiftyFourNinesSla({
      actualDowntimeNanoseconds: 0.00000000000000000000000000020, // < 0.0000000000000000000000000002592 ns
      pentaquadrillionFoamSingularityActive: true,
      bftQuorumConsensusPct: 99.99999999999, // >= 99.99999999999%
    });

    expect(audit.slaVerdict).toBe('FIFTY_FOUR_NINES_CERTIFIED');
    expect(audit.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.99999999999);
    expect(audit.violations).toHaveLength(0);
    expect(audit.auditSignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('triggers breach and liquidity penalty when downtime exceeds allowable budget or singularity drops', () => {
    const breach = evaluateFiftyFourNinesSla({
      actualDowntimeNanoseconds: 0.00000000000000000000000000050, // Exceeds budget
      pentaquadrillionFoamSingularityActive: false,
      bftQuorumConsensusPct: 98.5, // Below 99.99999999999%
    });

    expect(breach.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
    expect(breach.violations.length).toBeGreaterThanOrEqual(3);
    expect(breach.violations.some((v) => v.includes('exceeds allowable Fifty-Four-Nines budget'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('singularity mesh link is degraded'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('below required 99.99999999999% threshold'))).toBe(true);
  });
});
