/**
 * @file absolute-vacuum-energy-engine.test.ts
 * @layer tree/energy/__tests__
 * @description Unit tests for Absolute Vacuum Energy & Nineteen-Nines (99.99999999999999999%) SLA Guarantee.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateNineteenNinesSla,
  validateAbsoluteVacuumPower,
} from '../absolute-vacuum-energy-engine';
import { NINETEEN_NINES_SLA_CONSTANTS } from '@/seed/types/absolute-vacuum-singularity-nexus';

describe('Absolute Vacuum Energy & Nineteen-Nines SLA Engine', () => {
  it('validates compliant Net-Zero 0.0g CO2/kWh Absolute Vacuum power with COP >= 40.0', () => {
    const power = validateAbsoluteVacuumPower({
      allocatedMegawatts: 60_000_000,
      carbonIntensityGPerKwh: 0.0,
      cryoPowerMw: 10_000_000,
      boseEinsteinCop: 42.0, // >= 40.0
    });

    expect(power.isCompliant).toBe(true);
    expect(power.violations).toHaveLength(0);
    expect(power.verificationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects carbon intensity or cooling COP violations in power allocation', () => {
    const invalidPower = validateAbsoluteVacuumPower({
      allocatedMegawatts: 60_000_000,
      carbonIntensityGPerKwh: 0.05, // Non-zero
      cryoPowerMw: 10_000_000,
      boseEinsteinCop: 38.0, // < 40.0
    });

    expect(invalidPower.isCompliant).toBe(false);
    expect(invalidPower.violations).toHaveLength(2);
    expect(invalidPower.violations[0]).toContain('violates absolute net-zero');
    expect(invalidPower.violations[1]).toContain('below minimum requirement');
  });

  it('certifies Nineteen-Nines (99.99999999999999999%) SLA within allowable monthly downtime budget (<= 0.0002592 ns)', () => {
    const evaluation = evaluateNineteenNinesSla({
      totalWindowNanoseconds: NINETEEN_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS,
      actualDowntimeNanoseconds: 0.0002, // 0.0002 ns < 0.0002592 ns
      absoluteZeroPointEntanglementActive: true,
      bftQuorumConsensusPct: 99.999,
    });

    expect(evaluation.slaVerdict).toBe('NINETEEN_NINES_CERTIFIED');
    expect(evaluation.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.99999999999999);
    expect(evaluation.violations).toHaveLength(0);
    expect(evaluation.auditSignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('penalizes downtime breaches and inactive absolute zero-point entanglement', () => {
    const breach = evaluateNineteenNinesSla({
      totalWindowNanoseconds: NINETEEN_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS,
      actualDowntimeNanoseconds: 0.0005, // > 0.0002592 ns
      absoluteZeroPointEntanglementActive: false, // inactive
      bftQuorumConsensusPct: 98.0, // < 99.999%
    });

    expect(breach.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
    expect(breach.violations).toHaveLength(3);
  });
});
