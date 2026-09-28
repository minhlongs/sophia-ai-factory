/**
 * @file topological-vacuum-scheduler-engine.test.ts
 * @layer tree/compute/__tests__
 * @description Unit tests for Topological Vacuum Matrix & 20M Workload Dispatcher.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateTopologicalLatticeFitness,
  planVacuumBatchDispatch,
} from '../topological-vacuum-scheduler-engine';
import {
  FOURTEEN_NINES_SLA_CONSTANTS,
  type TopologicalVacuumComputeLattice,
} from '@/seed/types/topological-vacuum-nexus';

describe('Topological Vacuum Scheduler Engine', () => {
  const sampleStableLattice: TopologicalVacuumComputeLattice = {
    latticeRef: 'LATTICE-CORE-ALPHA',
    locationSector: 'PRIME_COSMIC_CORE',
    topologicalVacuumNodesCount: 300_000,
    waveguideLatencyNanos: 0.48, // sub-1.2 ns
    vacuumBusBandwidthPetabytes: 65_000,
    planckClockDriftFs: 14.2,
    activeSentientPipelinesCount: 10_000_000,
    thermalCopRatio: 18.2, // >= 16.0
    topologicalStatus: 'ANYONIC_FLUX_STABLE',
    latticeSignature: 'mock-lattice-sig-001',
  };

  const sampleDegradedLattice: TopologicalVacuumComputeLattice = {
    latticeRef: 'LATTICE-DEGRADED-BETA',
    locationSector: 'VIRGO_GRAVITON_SINK',
    topologicalVacuumNodesCount: 150_000,
    waveguideLatencyNanos: 1.85,
    vacuumBusBandwidthPetabytes: 20_000,
    planckClockDriftFs: 32.0,
    activeSentientPipelinesCount: 5_000_000,
    thermalCopRatio: 11.5,
    topologicalStatus: 'DEGRADED_THERMAL_DECAY',
    latticeSignature: 'mock-lattice-sig-002',
  };

  it('calculates lattice fitness and rejects unstable or degraded lattices', () => {
    const fitnessStable = calculateTopologicalLatticeFitness(sampleStableLattice);
    expect(fitnessStable).toBeGreaterThan(0.8);

    const fitnessDegraded = calculateTopologicalLatticeFitness(sampleDegradedLattice);
    expect(fitnessDegraded).toBe(0.0);
  });

  it('plans dispatch for 20,000,000 workloads to optimal stable lattice', () => {
    const altStableLattice: TopologicalVacuumComputeLattice = {
      ...sampleStableLattice,
      latticeRef: 'LATTICE-BACKUP-GAMMA',
      waveguideLatencyNanos: 0.95, // higher latency -> lower fitness
    };

    const plan = planVacuumBatchDispatch(
      [altStableLattice, sampleStableLattice],
      20_000_000,
      16.5
    );

    expect(plan.targetLatticeRef).toBe('LATTICE-CORE-ALPHA');
    expect(plan.assignedWorkloads).toBe(20_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(50_000);
    expect(plan.planckDriftFs).toBe(16.5);
    expect(plan.dispatchHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('throws error when relativistic clock drift exceeds Planck limit', () => {
    const excessiveDrift = FOURTEEN_NINES_SLA_CONSTANTS.MAX_PLANCK_CLOCK_DRIFT_FS + 5.0; // 30.0 fs

    expect(() =>
      planVacuumBatchDispatch([sampleStableLattice], 20_000_000, excessiveDrift)
    ).toThrow(/Planck relativistic clock drift/);
  });

  it('throws error when no stable lattices are available', () => {
    expect(() =>
      planVacuumBatchDispatch([sampleDegradedLattice], 20_000_000, 15.0)
    ).toThrow(/Zero stable topological vacuum lattices available/);
  });
});
