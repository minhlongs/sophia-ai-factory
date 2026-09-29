/**
 * @file omni-dimensional-energy-engine.test.ts
 * @layer tree/energy/__tests__
 * @description Unit tests for Omni-Dimensional Power & Thirty-Three-Nines (99.9999999999999999999999999999999%) SLA Guarantee.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateThirtyThreeNinesSla,
  validateOmniDimensionalPower,
} from '../omni-dimensional-energy-engine';

describe('Omni-Dimensional Energy & Thirty-Three-Nines SLA Engine', () => {
  it('validates compliant Omni-Dimensional harvest power with 0.0 carbon intensity and COP >= 60.0', () => {
    const output = validateOmniDimensionalPower({
      allocatedMegawatts: 500_000_000,
      carbonIntensityGPerKwh: 0.0,
      cryoPowerMw: 100_000_000,
      boseEinsteinCop: 62.5, // >= 60.0
    });

    expect(output.isCompliant).toBe(true);
    expect(output.violations).toHaveLength(0);
    expect(output.verificationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects power configurations that breach net-zero or minimum COP thresholds', () => {
    const invalid = validateOmniDimensionalPower({
      allocatedMegawatts: 0,
      carbonIntensityGPerKwh: 0.05, // > 0.0
      cryoPowerMw: 20_000_000,
      boseEinsteinCop: 45.0, // < 60.0
    });

    expect(invalid.isCompliant).toBe(false);
    expect(invalid.violations.length).toBeGreaterThanOrEqual(3);
    expect(invalid.violations.some((v) => v.includes('violates absolute net-zero'))).toBe(true);
    expect(invalid.violations.some((v) => v.includes('below minimum requirement'))).toBe(true);
    expect(invalid.violations.some((v) => v.includes('strictly positive'))).toBe(true);
  });

  it('certifies Thirty-Three-Nines continuous SLA when downtime is within 0.000000000002592 ns budget', () => {
    const audit = evaluateThirtyThreeNinesSla({
      actualDowntimeNanoseconds: 0.0000000000020, // < 0.000000000002592 ns
      omniDimensionalZeroPointEntanglementActive: true,
      bftQuorumConsensusPct: 99.9999999, // >= 99.999999%
    });

    expect(audit.slaVerdict).toBe('THIRTY_THREE_NINES_CERTIFIED');
    expect(audit.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.99999999999);
    expect(audit.violations).toHaveLength(0);
    expect(audit.auditSignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('triggers breach and liquidity penalty when downtime exceeds allowable budget or entanglement drops', () => {
    const breach = evaluateThirtyThreeNinesSla({
      actualDowntimeNanoseconds: 0.0000000000050, // Exceeds budget
      omniDimensionalZeroPointEntanglementActive: false,
      bftQuorumConsensusPct: 98.5, // Below 99.999999%
    });

    expect(breach.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
    expect(breach.violations.length).toBeGreaterThanOrEqual(3);
    expect(breach.violations.some((v) => v.includes('exceeds allowable Thirty-Three-Nines budget'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('planck foam entanglement is not active'))).toBe(true);
    expect(breach.violations.some((v) => v.includes('below 99.999999% threshold'))).toBe(true);
  });
});
