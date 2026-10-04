/**
 * @file milliaquadrillion-sub-planck-energy-engine.test.ts
 * @layer tree/energy/__tests__
 * @description Unit tests for Millia-Quadrillion Sub-Planck Power & Eighty-Four-Nines SLA Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateEightyFourNinesSla,
  validateMilliaquadrillionSubPlanckPower,
} from '../milliaquadrillion-sub-planck-energy-engine';
import { EIGHTY_FOUR_NINES_SLA_CONSTANTS } from '@/seed/types/milliaquadrillion-sub-planck-mesh-nexus';

describe('Millia-Quadrillion Sub-Planck Power & Eighty-Four-Nines SLA Engine', () => {
  it('validates compliant 200-Terawatt Net-Zero power allocation with COP >= 900.0', () => {
    const result = validateMilliaquadrillionSubPlanckPower({
      powerSourceType: 'MILLIAQUADRILLION_ZERO_POINT_HARVESTER',
      allocatedMegawatts: 200_000_000_000_000, // 200 Terawatts
      carbonIntensityGPerKwh: 0.0,
      boseEinsteinCop: 900.0,
      isNetZeroCertified: true,
    });

    expect(result.isCompliant).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.verificationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects violations when carbon intensity > 0 or COP is sub-threshold', () => {
    const result = validateMilliaquadrillionSubPlanckPower({
      powerSourceType: 'MILLIAQUADRILLION_ZERO_POINT_HARVESTER',
      allocatedMegawatts: 1_000_000,
      carbonIntensityGPerKwh: 0.5,
      boseEinsteinCop: 100.0, // < 900.0
      isNetZeroCertified: false,
    });

    expect(result.isCompliant).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
  });

  it('certifies Eighty-Four-Nines SLA compliance within microscopic downtime budget', () => {
    const result = evaluateEightyFourNinesSla({
      actualDowntimeNanoseconds: EIGHTY_FOUR_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS,
      milliaquadrillionFoamSingularityActive: true,
      bftQuorumConsensusPct: 99.999999999999999999999,
    });

    expect(result.slaVerdict).toBe('EIGHTY_FOUR_NINES_CERTIFIED');
    expect(result.violations).toHaveLength(0);
    expect(result.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.99999999999999);
    expect(result.auditSignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it('penalizes breach when downtime exceeds Eighty-Four-Nines budget', () => {
    const result = evaluateEightyFourNinesSla({
      actualDowntimeNanoseconds: 1.0, // 1 nanosecond >> 3.1536e-76 seconds
      milliaquadrillionFoamSingularityActive: true,
      bftQuorumConsensusPct: 99.999999999999999999999,
    });

    expect(result.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
    expect(result.violations.some((v) => v.includes('exceeds allowable'))).toBe(true);
  });
});
