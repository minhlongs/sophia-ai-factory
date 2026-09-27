import { describe, it, expect } from 'vitest';
import {
  validateDysonPowerAllocation,
  evaluateNineNinesSla,
} from '../dyson-power-engine';
import type { DysonPowerAllocation } from '@/seed/types/yottaflop-matrix';

describe('Dyson Power & Nine-Nines (99.9999999%) SLA Engine Unit Tests', () => {
  const compliantAllocation: DysonPowerAllocation = {
    id: 'alloc_dyson_01',
    allocationId: 'DYSON_SWARM_ALLOC_01',
    energySource: 'DYSON_SOLAR_COLLECTOR_ARRAY',
    allocatedMegawatts: 1200.0,
    carbonIntensityGCo2PerKwh: 0.0, // 100% Net Zero
    gridEfficiencyCop: 4.8,
    coolingThermalDeltaCelsius: 12.5,
    timestampRecorded: '2026-09-27T00:00:00Z',
  };

  it('validates compliant 100% net-zero Dyson Swarm power allocation', () => {
    const result = validateDysonPowerAllocation(compliantAllocation);
    expect(result.isCompliant).toBe(true);
    expect(result.thermalSafetyMarginPct).toBe(50); // (25 - 12.5) / 25 = 50%
  });

  it('rejects allocations with carbon intensity > 0 or low COP', () => {
    const dirtyAllocation: DysonPowerAllocation = {
      ...compliantAllocation,
      carbonIntensityGCo2PerKwh: 12.5, // Not net-zero
    };

    const result = validateDysonPowerAllocation(dirtyAllocation);
    expect(result.isCompliant).toBe(false);
    expect(result.reason).toContain('Carbon intensity must be 0.0');

    const inefficientAllocation: DysonPowerAllocation = {
      ...compliantAllocation,
      gridEfficiencyCop: 2.8, // < 3.5
    };

    const res2 = validateDysonPowerAllocation(inefficientAllocation);
    expect(res2.isCompliant).toBe(false);
    expect(res2.reason).toContain('Grid efficiency COP must be >= 3.5');
  });

  it('evaluates Nine-Nines (99.9999999%) SLA availability accurately', () => {
    // 30 days = 2,592,000,000,000 microseconds. Allowed downtime is 2592 microseconds (2.592 ms).
    // 1. Nominal case: 1,500 microseconds (1.5 ms) downtime -> PASS
    const nominalSla = evaluateNineNinesSla('2026-09-GATE14-PASS', 1500);
    expect(nominalSla.slaBreached).toBe(false);
    expect(nominalSla.availabilityPercentage).toBeGreaterThanOrEqual(99.9999999);
    expect(nominalSla.quantumTeleportationSyncValid).toBe(true);
    expect(nominalSla.byzantineValidatorsCount).toBe(32);
    expect(nominalSla.auditProofRoot).toMatch(/^[a-f0-9]{64}$/);

    // 2. Breached case: 3,000 microseconds (3.0 ms > 2.592 ms) -> BREACH
    const breachedSla = evaluateNineNinesSla('2026-09-GATE14-BREACH', 3000);
    expect(breachedSla.slaBreached).toBe(true);
    expect(breachedSla.quantumTeleportationSyncValid).toBe(false);
    expect(breachedSla.byzantineValidatorsCount).toBe(0);
  });
});
