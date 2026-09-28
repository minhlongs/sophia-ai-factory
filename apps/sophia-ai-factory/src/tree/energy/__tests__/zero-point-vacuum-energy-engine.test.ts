/**
 * @file zero-point-vacuum-energy-engine.test.ts
 * @layer tree/energy/__tests__
 * @description Unit tests for Zero-Point Cosmic Vacuum Power & Fourteen-Nines SLA Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateFourteenNinesSla,
  validateZeroPointPower,
} from '../zero-point-vacuum-energy-engine';
import { FOURTEEN_NINES_SLA_CONSTANTS } from '@/seed/types/topological-vacuum-nexus';

describe('Zero-Point Vacuum Energy & Fourteen-Nines SLA Engine', () => {
  describe('validateZeroPointPower', () => {
    it('certifies compliant zero-point cosmic power allocation', () => {
      const output = validateZeroPointPower({
        allocatedMegawatts: 1250,
        carbonIntensityGPerKwh: 0.0,
        cryoPowerMw: 320,
        boseEinsteinCop: 18.5, // >= 16.0
      });

      expect(output.isCompliant).toBe(true);
      expect(output.violations).toHaveLength(0);
      expect(output.verificationHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('rejects power with non-zero carbon emissions or substandard cooling COP', () => {
      const output = validateZeroPointPower({
        allocatedMegawatts: 800,
        carbonIntensityGPerKwh: 0.12, // violation
        cryoPowerMw: 150,
        boseEinsteinCop: 12.4, // < 16.0 violation
      });

      expect(output.isCompliant).toBe(false);
      expect(output.violations.length).toBeGreaterThanOrEqual(2);
      expect(output.violations[0]).toContain('Carbon intensity');
      expect(output.violations[1]).toContain('Cooling COP');
    });
  });

  describe('evaluateFourteenNinesSla', () => {
    it('certifies 99.999999999999% SLA when downtime is within sub-nanosecond limit', () => {
      const output = evaluateFourteenNinesSla({
        actualDowntimeNanoseconds: 12.4, // well under 25.92 ns
        anyonicEntanglementActive: true,
        bftQuorumConsensusPct: 100.0,
      });

      expect(output.slaVerdict).toBe('FOURTEEN_NINES_CERTIFIED');
      expect(output.violations).toHaveLength(0);
      expect(output.actualDowntimeNanoseconds).toBe(12.4);
      expect(output.maxAllowedDowntimeNanoseconds).toBe(
        FOURTEEN_NINES_SLA_CONSTANTS.MAX_ALLOWED_DOWNTIME_NANOSECONDS
      );
      expect(output.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.999999999999);
      expect(output.auditSignature).toMatch(/^[a-f0-9]{64}$/);
    });

    it('penalizes breach when downtime exceeds 25.92 ns threshold', () => {
      const output = evaluateFourteenNinesSla({
        actualDowntimeNanoseconds: 48.6, // > 25.92 ns
        anyonicEntanglementActive: true,
        bftQuorumConsensusPct: 100.0,
      });

      expect(output.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
      expect(output.violations.length).toBeGreaterThan(0);
      expect(output.violations[0]).toContain('exceeds maximum allowable Fourteen-Nines downtime');
    });

    it('penalizes when anyonic entanglement is down or BFT consensus is degraded', () => {
      const output = evaluateFourteenNinesSla({
        actualDowntimeNanoseconds: 5.0,
        anyonicEntanglementActive: false,
        bftQuorumConsensusPct: 98.5,
      });

      expect(output.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
      expect(output.violations).toContain(
        'Anyonic topological entangled state redundancy synchronization is inactive'
      );
      expect(output.violations).toContain(
        'Byzantine Fault Tolerant quorum consensus 98.5% is below 100.0% requirement'
      );
    });
  });
});
