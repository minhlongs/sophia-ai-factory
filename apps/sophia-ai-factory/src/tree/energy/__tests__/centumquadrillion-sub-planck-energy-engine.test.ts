/**
 * @file centumquadrillion-sub-planck-energy-engine.test.ts
 * @layer tree/energy/__tests__
 * @description Unit tests for Centum-Quadrillion Power Allocation & Sixty-Six-Nines Continuous SLA Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateSixtySixNinesSla,
  validateCentumquadrillionSubPlanckPower,
} from '../centumquadrillion-sub-planck-energy-engine';

describe('Centum-Quadrillion Power & Sixty-Six-Nines SLA Engine', () => {
  it('validates compliant 2-Terawatt Net-Zero power allocation with Bose-Einstein cooling COP >= 400.0', () => {
    const power = validateCentumquadrillionSubPlanckPower({
      powerSourceType: 'CENTUMQUADRILLION_ZERO_POINT_HARVESTER',
      allocatedMegawatts: 2_000_000_000_000,
      carbonIntensityGPerKwh: 0.0,
      boseEinsteinCop: 420.0,
      isNetZeroCertified: true,
    });

    expect(power.isCompliant).toBe(true);
    expect(power.violations).toHaveLength(0);
    expect(power.verificationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects power allocations violating Net-Zero or minimum COP requirements', () => {
    const nonCompliant = validateCentumquadrillionSubPlanckPower({
      powerSourceType: 'CENTUMQUADRILLION_ZERO_POINT_HARVESTER',
      allocatedMegawatts: 2_000_000_000_000,
      carbonIntensityGPerKwh: 0.5, // Non-zero
      boseEinsteinCop: 300.0, // Below 400.0
      isNetZeroCertified: false,
    });

    expect(nonCompliant.isCompliant).toBe(false);
    expect(nonCompliant.violations.length).toBeGreaterThanOrEqual(2);
  });

  it('certifies Sixty-Six-Nines SLA uptime with allowable downtime <= 2.592e-36 ns', () => {
    const sla = evaluateSixtySixNinesSla({
      actualDowntimeNanoseconds: 0.000000000000000000000000000000000001,
      centumquadrillionFoamSingularityActive: true,
      bftQuorumConsensusPct: 99.999999999999999,
    });

    expect(sla.slaVerdict).toBe('SIXTY_SIX_NINES_CERTIFIED');
    expect(sla.effectiveAvailabilityPct).toBeGreaterThan(99.999999999999);
    expect(sla.violations).toHaveLength(0);
    expect(sla.auditSignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('penalizes liquidity when downtime exceeds Sixty-Six-Nines budget', () => {
    const breach = evaluateSixtySixNinesSla({
      actualDowntimeNanoseconds: 1.0, // 1 ns exceeds budget
      centumquadrillionFoamSingularityActive: true,
      bftQuorumConsensusPct: 99.999999999999999,
    });

    expect(breach.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
    expect(breach.violations.some((v) => v.includes('exceeds allowable Sixty-Six-Nines budget'))).toBe(true);
  });
});
