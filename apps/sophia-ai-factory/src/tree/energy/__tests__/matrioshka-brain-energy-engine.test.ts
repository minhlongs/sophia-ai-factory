/**
 * @file matrioshka-brain-energy-engine.test.ts
 * @layer tree/energy
 * @description Unit tests for Matrioshka Brain Net-Zero Power & Thirteen-Nines (99.99999999999%) Continuous SLA.
 */

import { describe, it, expect } from 'vitest';
import {
  validateMatrioshkaPower,
  evaluateThirteenNinesSla,
} from '../matrioshka-brain-energy-engine';

describe('MatrioshkaBrainEnergyEngine', () => {
  it('validates compliant stellar clean power with COP >= 12.0 and zero carbon intensity', () => {
    const result = validateMatrioshkaPower({
      allocatedMegawatts: 850_000,
      carbonIntensityGPerKwh: 0.0,
      cryoPowerMw: 120_000,
      heliumCryoCop: 13.5, // >= 12.0
    });

    expect(result.isCompliant).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.verificationHash).toHaveLength(64);
  });

  it('rejects power allocations violating net-zero or cooling efficiency thresholds', () => {
    const dirtyResult = validateMatrioshkaPower({
      allocatedMegawatts: 850_000,
      carbonIntensityGPerKwh: 0.5, // > 0.0
      cryoPowerMw: 120_000,
      heliumCryoCop: 9.5, // < 12.0
    });

    expect(dirtyResult.isCompliant).toBe(false);
    expect(dirtyResult.violations).toHaveLength(2);
    expect(dirtyResult.violations[0]).toContain('violates absolute net-zero');
    expect(dirtyResult.violations[1]).toContain('below minimum requirement');
  });

  it('certifies Thirteen-Nines (99.99999999999%) continuous SLA availability', () => {
    const audit = evaluateThirteenNinesSla({
      actualDowntimeNanoseconds: 120.0, // < 259.2 ns (0.2592 µs)
      quantumEntanglementActive: true,
      bftQuorumConsensusPct: 100.0,
    });

    expect(audit.slaVerdict).toBe('THIRTEEN_NINES_CERTIFIED');
    expect(audit.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.99999999999);
    expect(audit.maxAllowedDowntimeNanoseconds).toBe(259.2);
    expect(audit.violations).toHaveLength(0);
    expect(audit.auditSignature).toHaveLength(64);
  });

  it('penalizes SLA breaches when monthly downtime exceeds 259.2 ns or redundancy drops', () => {
    const breachAudit = evaluateThirteenNinesSla({
      actualDowntimeNanoseconds: 500.0, // > 259.2 ns
      quantumEntanglementActive: false,
      bftQuorumConsensusPct: 95.0,
    });

    expect(breachAudit.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
    expect(breachAudit.violations).toHaveLength(3);
    expect(breachAudit.violations[0]).toContain('exceeds maximum allowable Thirteen-Nines downtime');
  });
});
