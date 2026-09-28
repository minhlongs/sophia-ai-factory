/**
 * @file sub-planck-energy-engine.test.ts
 * @layer tree/energy/__tests__
 * @description Unit tests for Sub-Planck Zero-Point Power & Seventeen-Nines (99.999999999999999%) Continuous SLA Guarantee.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateSeventeenNinesSla,
  validateSubPlanckPower,
} from '../sub-planck-energy-engine';
import { SEVENTEEN_NINES_SLA_CONSTANTS } from '@/seed/types/sub-planck-vacuum-nexus';

describe('Sub-Planck Power & Seventeen-Nines SLA Engine', () => {
  it('certifies Sub-Planck power compliance when carbon is 0.0 and COP >= 30.0', () => {
    const power = validateSubPlanckPower({
      allocatedMegawatts: 15_000_000,
      carbonIntensityGPerKwh: 0.0, // Strictly net-zero
      cryoPowerMw: 1_000_000,
      boseEinsteinCop: 31.5, // >= 30.0
    });

    expect(power.isCompliant).toBe(true);
    expect(power.violations).toHaveLength(0);
    expect(power.verificationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects power allocations with carbon emissions or inadequate cryo COP', () => {
    const dirtyPower = validateSubPlanckPower({
      allocatedMegawatts: 15_000_000,
      carbonIntensityGPerKwh: 0.02, // Violates 0.0
      cryoPowerMw: 1_000_000,
      boseEinsteinCop: 25.0, // < 30.0
    });

    expect(dirtyPower.isCompliant).toBe(false);
    expect(dirtyPower.violations).toHaveLength(2);
    expect(dirtyPower.violations[0]).toContain('violates absolute net-zero');
    expect(dirtyPower.violations[1]).toContain('below minimum requirement 30');
  });

  it('certifies Seventeen-Nines SLA when downtime <= 0.02592 ns and BFT consensus is 100%', () => {
    const sla = evaluateSeventeenNinesSla({
      totalWindowNanoseconds: SEVENTEEN_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS,
      actualDowntimeNanoseconds: 0.015, // <= 0.02592 ns
      anyonicEntanglementActive: true,
      bftQuorumConsensusPct: 100.0,
    });

    expect(sla.slaVerdict).toBe('SEVENTEEN_NINES_CERTIFIED');
    expect(sla.maxAllowedDowntimeNanoseconds).toBe(0.02592);
    expect(sla.actualDowntimeNanoseconds).toBe(0.015);
    expect(sla.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.999999999999999);
    expect(sla.violations).toHaveLength(0);
    expect(sla.auditSignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('penalizes breach when downtime exceeds 0.02592 ns or entanglement is inactive', () => {
    const breach = evaluateSeventeenNinesSla({
      actualDowntimeNanoseconds: 0.05, // > 0.02592 ns
      anyonicEntanglementActive: false,
      bftQuorumConsensusPct: 95.0,
    });

    expect(breach.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
    expect(breach.violations.length).toBe(3);
    expect(breach.violations[0]).toContain('exceeds maximum allowable Seventeen-Nines downtime');
    expect(breach.violations[1]).toContain('Anyonic topological entangled state');
    expect(breach.violations[2]).toContain('Byzantine Fault Tolerant');
  });
});
