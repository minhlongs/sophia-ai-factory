/**
 * @file dyson-swarm-energy-engine.test.ts
 * @layer tree/energy
 * @description Unit tests for Dyson Swarm net-zero power and Twelve-Nines continuous SLA evaluation.
 */

import { describe, it, expect } from 'vitest';
import {
  validateDysonPower,
  evaluateTwelveNinesSla,
} from '../dyson-swarm-energy-engine';

describe('DysonSwarmEnergyEngine', () => {
  it('validates compliant net-zero Dyson Swarm power with COP >= 9.0 cryo cooling', () => {
    const output = validateDysonPower({
      allocatedMegawatts: 500_000.0,
      carbonIntensityGCo2PerKwh: 0.0,
      cryoCoolingPowerMw: 50_000.0,
      coolingEfficiencyCop: 9.6,
    });

    expect(output.isCompliant).toBe(true);
    expect(output.violations).toHaveLength(0);
    expect(output.verificationHash).toHaveLength(64);
  });

  it('detects violations when carbon intensity > 0 or COP is below 9.0', () => {
    const output = validateDysonPower({
      allocatedMegawatts: 300_000.0,
      carbonIntensityGCo2PerKwh: 5.0,
      cryoCoolingPowerMw: 20_000.0,
      coolingEfficiencyCop: 7.8,
    });

    expect(output.isCompliant).toBe(false);
    expect(output.violations).toHaveLength(2);
    expect(output.violations[0]).toContain('Carbon intensity 5 g CO2/kWh violates absolute net-zero');
    expect(output.violations[1]).toContain('Cooling COP 7.8 is below minimum requirement 9');
  });

  it('certifies Twelve-Nines SLA when downtime <= 2.592 µs and redundancy is 100% active', () => {
    const audit = evaluateTwelveNinesSla({
      actualDowntimeMicroseconds: 1.8, // 1.8 µs < 2.592 µs
      tachyonEntanglementActive: true,
      bftQuorumConsensusPct: 100.0,
    });

    expect(audit.slaVerdict).toBe('TWELVE_NINES_CERTIFIED');
    expect(audit.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.9999999999);
    expect(audit.violations).toHaveLength(0);
    expect(audit.auditSignature).toHaveLength(64);
  });

  it('flags breach and penalizes liquidity when downtime exceeds 2.592 µs or BFT quorum is incomplete', () => {
    const audit = evaluateTwelveNinesSla({
      actualDowntimeMicroseconds: 4.5, // 4.5 µs > 2.592 µs
      tachyonEntanglementActive: false,
      bftQuorumConsensusPct: 99.2,
    });

    expect(audit.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
    expect(audit.violations).toHaveLength(3);
    expect(audit.violations[0]).toContain('exceeds maximum allowable Twelve-Nines downtime');
    expect(audit.violations[1]).toContain('Tachyon quantum entangled state redundancy synchronization is inactive');
    expect(audit.violations[2]).toContain('Byzantine Fault Tolerant quorum consensus 99.2% is below 100.0%');
  });
});
