/**
 * @file net-zero-sla-domain-engine.test.ts
 * @layer tree/energy
 * @description Unit tests for canonical Net-Zero SLA Domain Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  validateParameterizedPower,
  evaluateParameterizedMultiNinesSla,
} from '../net-zero-sla-domain-engine';

describe('NetZeroSlaDomainEngine (Canonical Parameterized Energy Engine)', () => {
  it('validates compliant 0.0g carbon intensity net-zero power', () => {
    const result = validateParameterizedPower(
      {
        allocatedMegawatts: 3_500_000,
        carbonIntensityGPerKwh: 0.0,
        cryoPowerMw: 750_000,
        boseEinsteinCop: 22.0,
      },
      {
        minCop: 20.0,
      }
    );

    expect(result.isCompliant).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.verificationHash).toHaveLength(64);
  });

  it('rejects power validation when carbon intensity is non-zero', () => {
    const result = validateParameterizedPower(
      {
        allocatedMegawatts: 3_500_000,
        carbonIntensityGPerKwh: 5.0,
        cryoPowerMw: 750_000,
        boseEinsteinCop: 22.0,
      },
      {
        minCop: 20.0,
      }
    );

    expect(result.isCompliant).toBe(false);
    expect(result.violations).toContain(
      'Carbon intensity 5 g CO2/kWh violates absolute net-zero (0 required)'
    );
  });

  it('evaluates multi-nines SLA within allowed downtime threshold', () => {
    const result = evaluateParameterizedMultiNinesSla(
      {
        actualDowntimeNanoseconds: 1.8,
        anyonicEntanglementActive: true,
        bftQuorumConsensusPct: 100.0,
      },
      {
        maxAllowedDowntime: 2.592,
        certifiedVerdict: 'FIFTEEN_NINES_CERTIFIED',
        breachVerdict: 'BREACH_PENALTY',
      }
    );

    expect(result.slaVerdict).toBe('FIFTEEN_NINES_CERTIFIED');
    expect(result.violations).toHaveLength(0);
    expect(result.effectiveAvailabilityPct).toBeGreaterThanOrEqual(99.9999999999999);
    expect(result.auditSignature).toHaveLength(64);
  });

  it('detects SLA downtime breach and issues penalized verdict', () => {
    const result = evaluateParameterizedMultiNinesSla(
      {
        actualDowntimeNanoseconds: 10.0,
        anyonicEntanglementActive: true,
        bftQuorumConsensusPct: 100.0,
      },
      {
        maxAllowedDowntime: 2.592,
        certifiedVerdict: 'FIFTEEN_NINES_CERTIFIED',
        breachVerdict: 'BREACH_LIQUIDITY_PENALIZED',
      }
    );

    expect(result.slaVerdict).toBe('BREACH_LIQUIDITY_PENALIZED');
    expect(result.violations.length).toBeGreaterThan(0);
  });
});
