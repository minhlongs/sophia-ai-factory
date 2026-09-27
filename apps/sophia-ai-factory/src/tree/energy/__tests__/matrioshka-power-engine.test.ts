/**
 * @file matrioshka-power-engine.test.ts
 * @description Unit tests for Matrioshka Brain clean power and Ten-Nines (99.99999999%) SLA engine.
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateTenNinesSla,
  validateMatrioshkaPower,
} from '../matrioshka-power-engine';

describe('Matrioshka Power & Ten-Nines SLA Engine', () => {
  it('1. Validates strict net-zero carbon intensity (0.0 g CO2/kWh) and cryo-cooling COP', () => {
    const valid = validateMatrioshkaPower({
      allocatedMegawatts: 15_000,
      carbonIntensityGCo2PerKwh: 0.0,
      cryoCoolingPowerMw: 3_000,
      coolingEfficiencyCop: 7.2,
    });
    expect(valid.isCompliant).toBe(true);
    expect(valid.violations).toHaveLength(0);
    expect(valid.verificationHash).toHaveLength(64);

    // Non-zero carbon rejection
    const dirty = validateMatrioshkaPower({
      allocatedMegawatts: 15_000,
      carbonIntensityGCo2PerKwh: 0.05, // 0.05 > 0.0
      cryoCoolingPowerMw: 3_000,
      coolingEfficiencyCop: 5.0, // 5.0 < 6.5
    });
    expect(dirty.isCompliant).toBe(false);
    expect(dirty.violations.length).toBeGreaterThanOrEqual(2);
  });

  it('2. Certifies Ten-Nines SLA when downtime <= 259 microseconds and BFT quorum is 100%', () => {
    const certified = evaluateTenNinesSla({
      actualDowntimeMicroseconds: 150, // 150 µs <= 259 µs
      quantumTeleportSyncActive: true,
      bftQuorumConsensusPct: 100.0,
    });

    expect(certified.slaVerdict).toBe('TEN_NINES_CERTIFIED');
    expect(certified.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.99999999);
    expect(certified.violations).toHaveLength(0);
    expect(certified.auditSignature).toHaveLength(64);
  });

  it('3. Penalizes SLA breach when downtime exceeds 259 microseconds (0.2592 ms threshold)', () => {
    const breached = evaluateTenNinesSla({
      actualDowntimeMicroseconds: 500, // 500 µs > 259 µs
      quantumTeleportSyncActive: true,
      bftQuorumConsensusPct: 100.0,
    });

    expect(breached.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
    expect(breached.violations.length).toBeGreaterThanOrEqual(1);
    expect(breached.violations[0]).toContain('exceeds maximum allowable Ten-Nines downtime');
  });
});
