/**
 * @file quingentimilliaquadrillion-sub-planck-energy-engine.test.ts
 * @layer tree/energy/__tests__
 * @description Unit tests for Quingenti-Millia-Quadrillion Sub-Planck Power & Ninety-Nines SLA Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateNinetyNinesSla,
  validateQuingentimilliaquadrillionSubPlanckPower,
} from '../quingentimilliaquadrillion-sub-planck-energy-engine';
import { NINETY_NINES_SLA_CONSTANTS } from '@/seed/types/quingentimilliaquadrillion-sub-planck-mesh-nexus';

describe('Quingenti-Millia-Quadrillion Sub-Planck Power & Ninety-Nines SLA Engine', () => {
  it('validates compliant 1-Petawatt (1,000-Terawatt) Net-Zero power allocation with COP >= 1200.0', () => {
    const result = validateQuingentimilliaquadrillionSubPlanckPower({
      powerSourceType: 'QUINGENTIMILLIAQUADRILLION_ZERO_POINT_HARVESTER',
      allocatedMegawatts: 1000_000_000_000_000, // 1 Petawatt
      carbonIntensityGPerKwh: 0.0,
      boseEinsteinCop: 1200.0,
      isNetZeroCertified: true,
    });

    expect(result.isCompliant).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.verificationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects violations when carbon intensity > 0 or COP is sub-threshold', () => {
    const result = validateQuingentimilliaquadrillionSubPlanckPower({
      powerSourceType: 'QUINGENTIMILLIAQUADRILLION_ZERO_POINT_HARVESTER',
      allocatedMegawatts: 1_000_000,
      carbonIntensityGPerKwh: 0.5,
      boseEinsteinCop: 100.0, // < 1200.0
      isNetZeroCertified: false,
    });

    expect(result.isCompliant).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
  });

  it('certifies Ninety-Nines SLA compliance within microscopic downtime budget', () => {
    const result = evaluateNinetyNinesSla({
      actualDowntimeNanoseconds: NINETY_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS,
      quingentimilliaquadrillionFoamSingularityActive: true,
      bftQuorumConsensusPct: 99.99999999999999999999999,
    });

    expect(result.slaVerdict).toBe('NINETY_NINES_CERTIFIED');
    expect(result.violations).toHaveLength(0);
    expect(result.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.99999999999999);
    expect(result.auditSignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('penalizes breach when downtime exceeds Ninety-Nines budget', () => {
    const result = evaluateNinetyNinesSla({
      actualDowntimeNanoseconds: 1.0, // 1 nanosecond >> 3.1536e-82 seconds
      quingentimilliaquadrillionFoamSingularityActive: true,
      bftQuorumConsensusPct: 99.99999999999999999999999,
    });

    expect(result.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
    expect(result.violations.some((v) => v.includes('exceeds allowable'))).toBe(true);
  });
});
