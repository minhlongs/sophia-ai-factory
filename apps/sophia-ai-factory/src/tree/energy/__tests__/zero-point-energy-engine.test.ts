/**
 * @file zero-point-energy-engine.test.ts
 * @layer tree/energy/__tests__
 * @description Unit tests for Zero-Point Energy & Eighteen-Nines (99.9999999999999999%) SLA Guarantee.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateEighteenNinesSla,
  validateZeroPointPower,
} from '../zero-point-energy-engine';
import { EIGHTEEN_NINES_SLA_CONSTANTS } from '@/seed/types/zero-point-vacuum-nexus';

describe('Zero-Point Energy & Eighteen-Nines SLA Engine', () => {
  it('validates compliant Net-Zero 0.0g CO2/kWh Zero-Point power with COP >= 35.0', () => {
    const power = validateZeroPointPower({
      allocatedMegawatts: 30_000_000,
      carbonIntensityGPerKwh: 0.0,
      cryoPowerMw: 5_000_000,
      boseEinsteinCop: 36.0, // >= 35.0
    });

    expect(power.isCompliant).toBe(true);
    expect(power.violations).toHaveLength(0);
    expect(power.verificationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects carbon intensity or cooling COP violations in power allocation', () => {
    const invalidPower = validateZeroPointPower({
      allocatedMegawatts: 30_000_000,
      carbonIntensityGPerKwh: 0.05, // Non-zero
      cryoPowerMw: 5_000_000,
      boseEinsteinCop: 32.0, // < 35.0
    });

    expect(invalidPower.isCompliant).toBe(false);
    expect(invalidPower.violations).toHaveLength(2);
    expect(invalidPower.violations[0]).toContain('violates absolute net-zero');
    expect(invalidPower.violations[1]).toContain('below minimum requirement');
  });

  it('certifies Eighteen-Nines (99.9999999999999999%) SLA within allowable monthly downtime budget (<= 0.002592 ns)', () => {
    const evaluation = evaluateEighteenNinesSla({
      totalWindowNanoseconds: EIGHTEEN_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS,
      actualDowntimeNanoseconds: 0.002, // 0.002 ns < 0.002592 ns
      zeroPointEntanglementActive: true,
      bftQuorumConsensusPct: 99.95,
    });

    expect(evaluation.slaVerdict).toBe('EIGHTEEN_NINES_CERTIFIED');
    expect(evaluation.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.99999999999999);
    expect(evaluation.violations).toHaveLength(0);
    expect(evaluation.auditSignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('penalizes downtime breaches and inactive zero-point entanglement', () => {
    const breach = evaluateEighteenNinesSla({
      totalWindowNanoseconds: EIGHTEEN_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS,
      actualDowntimeNanoseconds: 0.005, // > 0.002592 ns
      zeroPointEntanglementActive: false, // inactive
      bftQuorumConsensusPct: 98.0, // < 99.9%
    });

    expect(breach.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
    expect(breach.violations).toHaveLength(3);
  });
});
