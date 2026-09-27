/**
 * @file kardashev-energy-engine.test.ts
 * @layer tree/energy
 * @description Unit tests for Kardashev stellar power and Eleven-Nines continuous SLA evaluation.
 */

import { describe, it, expect } from 'vitest';
import {
  validateKardashevPower,
  evaluateElevenNinesSla,
} from '../kardashev-energy-engine';

describe('KardashevEnergyEngine', () => {
  it('validates compliant net-zero Kardashev power with high COP cryo cooling', () => {
    const output = validateKardashevPower({
      allocatedMegawatts: 100.0,
      carbonIntensityGCo2PerKwh: 0.0,
      cryoCoolingPowerMw: 15.0,
      coolingEfficiencyCop: 8.5,
    });

    expect(output.isCompliant).toBe(true);
    expect(output.violations).toHaveLength(0);
    expect(output.verificationHash).toHaveLength(64);
  });

  it('detects violations when carbon intensity > 0 or COP is below 8.0', () => {
    const output = validateKardashevPower({
      allocatedMegawatts: 80.0,
      carbonIntensityGCo2PerKwh: 12.5,
      cryoCoolingPowerMw: 10.0,
      coolingEfficiencyCop: 6.2,
    });

    expect(output.isCompliant).toBe(false);
    expect(output.violations).toHaveLength(2);
    expect(output.violations[0]).toContain('Carbon intensity 12.5 g CO2/kWh violates absolute net-zero');
    expect(output.violations[1]).toContain('Cooling COP 6.2 is below minimum requirement 8');
  });

  it('certifies Eleven-Nines SLA when downtime <= 25 µs and redundancy is 100% active', () => {
    const audit = evaluateElevenNinesSla({
      actualDowntimeMicroseconds: 18, // 18 µs < 25 µs
      quantumEntangledRedundancyActive: true,
      bftQuorumConsensusPct: 100.0,
    });

    expect(audit.slaVerdict).toBe('ELEVEN_NINES_CERTIFIED');
    expect(audit.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.999999999);
    expect(audit.violations).toHaveLength(0);
    expect(audit.auditSignature).toHaveLength(64);
  });

  it('flags breach and penalizes liquidity when downtime exceeds 25 µs or BFT quorum is incomplete', () => {
    const audit = evaluateElevenNinesSla({
      actualDowntimeMicroseconds: 50, // 50 µs > 25 µs
      quantumEntangledRedundancyActive: false,
      bftQuorumConsensusPct: 98.5,
    });

    expect(audit.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
    expect(audit.violations).toHaveLength(3);
    expect(audit.violations[0]).toContain('exceeds maximum allowable Eleven-Nines downtime');
    expect(audit.violations[1]).toContain('Quantum entangled state redundancy synchronization is inactive');
    expect(audit.violations[2]).toContain('Byzantine Fault Tolerant quorum consensus 98.5% is below 100.0%');
  });
});
