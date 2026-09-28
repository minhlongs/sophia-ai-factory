/**
 * @file quantum-foam-energy-engine.test.ts
 * @layer tree/energy/__tests__
 * @description Unit tests for Zero-Point Quantum Foam Power & Sixteen-Nines (99.99999999999999%) Continuous SLA Guarantee.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateSixteenNinesSla,
  validateQuantumFoamPower,
} from '../quantum-foam-energy-engine';
import { SIXTEEN_NINES_SLA_CONSTANTS } from '@/seed/types/planck-quantum-foam-nexus';

describe('Quantum Foam Power & Sixteen-Nines SLA Engine', () => {
  it('certifies Zero-Point Quantum Foam power compliance when carbon is 0.0 and COP >= 25.0', () => {
    const power = validateQuantumFoamPower({
      allocatedMegawatts: 7_500_000,
      carbonIntensityGPerKwh: 0.0, // Strictly net-zero
      cryoPowerMw: 500_000,
      boseEinsteinCop: 26.5, // >= 25.0
    });

    expect(power.isCompliant).toBe(true);
    expect(power.violations).toHaveLength(0);
    expect(power.verificationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects power allocations with carbon emissions or inadequate cryo COP', () => {
    const dirtyPower = validateQuantumFoamPower({
      allocatedMegawatts: 7_500_000,
      carbonIntensityGPerKwh: 0.05, // Violates 0.0
      cryoPowerMw: 500_000,
      boseEinsteinCop: 20.0, // < 25.0
    });

    expect(dirtyPower.isCompliant).toBe(false);
    expect(dirtyPower.violations).toHaveLength(2);
    expect(dirtyPower.violations[0]).toContain('violates absolute net-zero');
    expect(dirtyPower.violations[1]).toContain('below minimum requirement 25');
  });

  it('certifies Sixteen-Nines SLA when downtime <= 0.2592 ns and BFT consensus is 100%', () => {
    const sla = evaluateSixteenNinesSla({
      totalWindowNanoseconds: SIXTEEN_NINES_SLA_CONSTANTS.TOTAL_MONTHLY_NANOSECONDS,
      actualDowntimeNanoseconds: 0.15, // <= 0.2592 ns
      anyonicEntanglementActive: true,
      bftQuorumConsensusPct: 100.0,
    });

    expect(sla.slaVerdict).toBe('SIXTEEN_NINES_CERTIFIED');
    expect(sla.maxAllowedDowntimeNanoseconds).toBe(0.2592);
    expect(sla.actualDowntimeNanoseconds).toBe(0.15);
    expect(sla.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.99999999999999);
    expect(sla.violations).toHaveLength(0);
    expect(sla.auditSignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('penalizes breach when downtime exceeds 0.2592 ns or entanglement is inactive', () => {
    const breach = evaluateSixteenNinesSla({
      actualDowntimeNanoseconds: 1.0, // > 0.2592 ns
      anyonicEntanglementActive: false,
      bftQuorumConsensusPct: 95.0,
    });

    expect(breach.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
    expect(breach.violations.length).toBe(3);
    expect(breach.violations[0]).toContain('exceeds maximum allowable Sixteen-Nines downtime');
    expect(breach.violations[1]).toContain('Anyonic topological entangled state');
    expect(breach.violations[2]).toContain('Byzantine Fault Tolerant');
  });
});
