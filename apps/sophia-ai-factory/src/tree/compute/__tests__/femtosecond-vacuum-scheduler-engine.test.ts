/**
 * @file femtosecond-vacuum-scheduler-engine.test.ts
 * @layer tree/compute/__tests__
 * @description Unit tests for Femtosecond Vacuum Matrix & 40M Workload Dispatcher.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateFemtosecondMatrixFitness,
  planFemtosecondBatchDispatch,
} from '../femtosecond-vacuum-scheduler-engine';
import {
  FIFTEEN_NINES_SLA_CONSTANTS,
  type FemtosecondVacuumComputeMatrix,
} from '@/seed/types/femtosecond-vacuum-nexus';

describe('Femtosecond Vacuum Scheduler Engine', () => {
  const sampleStableMatrix: FemtosecondVacuumComputeMatrix = {
    matrixRef: 'FEMTO-MATRIX-ALPHA',
    locationSector: 'PRIME_MULTIVERSE_CORE',
    femtosecondVacuumNodesCount: 600_000,
    waveguideLatencyNanos: 0.35, // sub-0.8 ns
    vacuumBusBandwidthPetabytes: 120_000,
    planckClockDriftFs: 7.5, // sub-10 fs
    activeSentientPipelinesCount: 20_000_000,
    thermalCopRatio: 22.5, // >= 20.0
    vacuumMatrixStatus: 'ANYONIC_FLUX_STABLE',
    matrixSignature: 'sig-femto-alpha',
  };

  const sampleDegradedMatrix: FemtosecondVacuumComputeMatrix = {
    matrixRef: 'FEMTO-MATRIX-DEGRADED',
    locationSector: 'COSMIC_HORIZON_SINK',
    femtosecondVacuumNodesCount: 200_000,
    waveguideLatencyNanos: 1.5,
    vacuumBusBandwidthPetabytes: 40_000,
    planckClockDriftFs: 18.0,
    activeSentientPipelinesCount: 10_000_000,
    thermalCopRatio: 14.0,
    vacuumMatrixStatus: 'DEGRADED_THERMAL_DECAY',
    matrixSignature: 'sig-femto-degraded',
  };

  it('calculates matrix fitness and rejects degraded or unstable matrices', () => {
    const fitnessStable = calculateFemtosecondMatrixFitness(sampleStableMatrix);
    expect(fitnessStable).toBeGreaterThan(0.8);

    const fitnessDegraded = calculateFemtosecondMatrixFitness(sampleDegradedMatrix);
    expect(fitnessDegraded).toBe(0.0);
  });

  it('plans dispatch for 40,000,000 workloads to optimal stable matrix', () => {
    const plan = planFemtosecondBatchDispatch(
      [sampleStableMatrix],
      40_000_000,
      8.0
    );

    expect(plan.targetMatrixRef).toBe('FEMTO-MATRIX-ALPHA');
    expect(plan.assignedWorkloads).toBe(40_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(100_000);
    expect(plan.planckDriftFs).toBe(8.0);
    expect(plan.dispatchHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('throws error when relativistic clock drift exceeds Planck limit', () => {
    const excessiveDrift = FIFTEEN_NINES_SLA_CONSTANTS.MAX_PLANCK_CLOCK_DRIFT_FS + 5.0; // 15.0 fs

    expect(() =>
      planFemtosecondBatchDispatch([sampleStableMatrix], 40_000_000, excessiveDrift)
    ).toThrow(/Planck relativistic clock drift/);
  });

  it('throws error when no stable matrices are available', () => {
    expect(() =>
      planFemtosecondBatchDispatch([sampleDegradedMatrix], 40_000_000, 7.0)
    ).toThrow(/Zero stable femtosecond vacuum matrices available/);
  });
});
