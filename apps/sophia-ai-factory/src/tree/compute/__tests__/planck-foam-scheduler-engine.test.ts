/**
 * @file planck-foam-scheduler-engine.test.ts
 * @layer tree/compute/__tests__
 * @description Unit tests for Planck-Scale Quantum Foam Super-Lattice & 100M Workload Dispatch Scheduler Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  calculatePlanckFoamMatrixFitness,
  planPlanckFoamBatchDispatch,
} from '../planck-foam-scheduler-engine';
import type { PlanckQuantumFoamLattice } from '@/seed/types/planck-quantum-foam-nexus';

describe('Planck Quantum Foam Scheduler Engine', () => {
  const sampleLattices: PlanckQuantumFoamLattice[] = [
    {
      latticeRef: 'LATTICE-OMEGA-01',
      locationSector: 'OMEGA_POINT_CORE',
      planckVacuumNodesCount: 1_048_576,
      waveguideLatencyNanos: 0.28, // Sub-0.5 ns
      vacuumBusBandwidthPetabytes: 250_000,
      planckClockDriftFs: 4.2, // Sub-5 fs
      activeSentientPipelinesCount: 100_000_000,
      thermalCopRatio: 26.5, // >= 25.0
      foamLatticeStatus: 'ANYONIC_FLUX_STABLE',
      latticeSignature: 'sig_omega_01',
    },
    {
      latticeRef: 'LATTICE-DEGRADED-02',
      locationSector: 'CONTINUUM_SINK',
      planckVacuumNodesCount: 524_288,
      waveguideLatencyNanos: 0.65,
      vacuumBusBandwidthPetabytes: 100_000,
      planckClockDriftFs: 8.0,
      activeSentientPipelinesCount: 10_000_000,
      thermalCopRatio: 18.0,
      foamLatticeStatus: 'DEGRADED_THERMAL_DECAY',
      latticeSignature: 'sig_degraded_02',
    },
  ];

  it('calculates matrix fitness score with 0.0 for degraded lattices and high score for stable ones', () => {
    const degradedScore = calculatePlanckFoamMatrixFitness(sampleLattices[1]);
    expect(degradedScore).toBe(0.0);

    const stableScore = calculatePlanckFoamMatrixFitness(sampleLattices[0]);
    expect(stableScore).toBeGreaterThan(0.80);
  });

  it('plans optimal 100,000,000 batch workload dispatch across stable quantum foam lattices', () => {
    const plan = planPlanckFoamBatchDispatch(sampleLattices, 100_000_000, 4.2);

    expect(plan.targetLatticeRef).toBe('LATTICE-OMEGA-01');
    expect(plan.assignedWorkloads).toBe(100_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(250_000); // 100M * 2.5 / 1000 = 250,000 PB
    expect(plan.planckDriftFs).toBe(4.2);
    expect(plan.dispatchHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects dispatch if relativistic clock drift exceeds 5 fs limit', () => {
    expect(() =>
      planPlanckFoamBatchDispatch(sampleLattices, 100_000_000, 6.5)
    ).toThrow(/Planck relativistic clock drift 6.5 fs exceeds allowable threshold 5 fs/);
  });

  it('rejects dispatch if no stable lattices exist', () => {
    const unstableOnly = [sampleLattices[1]];
    expect(() => planPlanckFoamBatchDispatch(unstableOnly, 100_000_000)).toThrow(
      /Zero stable planck quantum foam lattices available/
    );
  });
});
