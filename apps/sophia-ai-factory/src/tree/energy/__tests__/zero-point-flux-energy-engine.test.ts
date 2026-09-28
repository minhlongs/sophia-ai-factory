/**
 * @file zero-point-flux-energy-engine.test.ts
 * @layer tree/energy/__tests__
 * @description Unit tests for Zero-Point Vacuum Flux Power & Fifteen-Nines SLA Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateFifteenNinesSla,
  validateZeroPointFluxPower,
} from '../zero-point-flux-energy-engine';
import { FIFTEEN_NINES_SLA_CONSTANTS } from '@/seed/types/femtosecond-vacuum-nexus';

describe('Zero-Point Flux Energy & Fifteen-Nines SLA Engine', () => {
  describe('validateZeroPointFluxPower', () => {
    it('certifies compliant zero-point vacuum flux power allocation', () => {
      const output = validateZeroPointFluxPower({
        allocatedMegawatts: 3_500_000,
        carbonIntensityGPerKwh: 0.0,
        cryoPowerMw: 750_000,
        boseEinsteinCop: 22.5, // >= 20.0
      });

      expect(output.isCompliant).toBe(true);
      expect(output.violations).toHaveLength(0);
      expect(output.verificationHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('rejects power with non-zero carbon emissions or substandard cooling COP', () => {
      const output = validateZeroPointFluxPower({
        allocatedMegawatts: 2_000_000,
        carbonIntensityGPerKwh: 0.08, // violation
        cryoPowerMw: 400_000,
        boseEinsteinCop: 16.0, // < 20.0 violation
      });

      expect(output.isCompliant).toBe(false);
      expect(output.violations.length).toBeGreaterThanOrEqual(2);
      expect(output.violations[0]).toContain('Carbon intensity');
      expect(output.violations[1]).toContain('Cooling COP');
    });
  });

  describe('evaluateFifteenNinesSla', () => {
    it('certifies 99.9999999999999% SLA when downtime is within sub-nanosecond limit', () => {
      const output = evaluateFifteenNinesSla({
        actualDowntimeNanoseconds: 1.25, // well under 2.592 ns
        anyonicEntanglementActive: true,
        bftQuorumConsensusPct: 100.0,
      });

      expect(output.slaVerdict).toBe('FIFTEEN_NINES_CERTIFIED');
      expect(output.violations).toHaveLength(0);
      expect(output.actualDowntimeNanoseconds).toBe(1.25);
      expect(output.maxAllowedDowntimeNanoseconds).toBe(
        FIFTEEN_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS
      );
      expect(output.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.9999999999999);
      expect(output.auditSignature).toMatch(/^[a-f0-9]{64}$/);
    });

    it('penalizes breach when downtime exceeds 2.592 ns threshold', () => {
      const output = evaluateFifteenNinesSla({
        actualDowntimeNanoseconds: 5.8, // > 2.592 ns
        anyonicEntanglementActive: true,
        bftQuorumConsensusPct: 100.0,
      });

      expect(output.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
      expect(output.violations.length).toBeGreaterThan(0);
      expect(output.violations[0]).toContain('exceeds maximum allowable Fifteen-Nines downtime');
    });

    it('penalizes when anyonic entanglement is inactive or BFT consensus is degraded', () => {
      const output = evaluateFifteenNinesSla({
        actualDowntimeNanoseconds: 0.8,
        anyonicEntanglementActive: false,
        bftQuorumConsensusPct: 99.0,
      });

      expect(output.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
      expect(output.violations).toContain(
        'Anyonic topological entangled state redundancy synchronization is inactive'
      );
      expect(output.violations).toContain(
        'Byzantine Fault Tolerant quorum consensus 99% is below 100.0% requirement'
      );
    });
  });
});
