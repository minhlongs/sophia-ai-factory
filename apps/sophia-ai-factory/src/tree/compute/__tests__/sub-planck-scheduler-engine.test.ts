/**
 * @file sub-planck-scheduler-engine.test.ts
 * @layer tree/compute/__tests__
 * @description Unit tests for Sub-Planck Quantum Vacuum Foam Lattice & 200M Workload Dispatch Scheduler Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateSubPlanckFoamMatrixFitness,
  planSubPlanckBatchDispatch,
} from '../sub-planck-scheduler-engine';
import type { SubPlanckFoamLattice } from '@/seed/types/sub-planck-vacuum-nexus';

describe('Sub-Planck Quantum Vacuum Foam Scheduler Engine', () => {
  const sampleLattices: SubPlanckFoamLattice[] = [
    {
      latticeRef: 'LATTICE-SUB-PLANCK-01',
      locationSector: 'OMNIPRESENT_CORE',
      subPlanckVacuumNodesCount: 2_097_152,
      vacuumBusLatencyNanos: 0.05, // Sub-0.1 ns
      vacuumBusBandwidthPetabytes: 500_000,
      planckClockDriftFs: 0.8, // Sub-1 fs
      activeSentientPipelinesCount: 200_000_000,
      thermalCopRatio: 32.5, // >= 30.0
      foamLatticeStatus: 'ANYONIC_FLUX_STABLE',
      latticeSignature: 'sig_sub_planck_01',
    },
    {
      latticeRef: 'LATTICE-DEGRADED-02',
      locationSector: 'COSMOLOGICAL_HORIZON',
      subPlanckVacuumNodesCount: 1_048_576,
      vacuumBusLatencyNanos: 0.25,
      vacuumBusBandwidthPetabytes: 100_000,
      planckClockDriftFs: 2.5,
      activeSentientPipelinesCount: 20_000_000,
      thermalCopRatio: 22.0,
      foamLatticeStatus: 'DEGRADED_THERMAL_DECAY',
      latticeSignature: 'sig_degraded_02',
    },
  ];

  it('calculates matrix fitness score with 0.0 for degraded lattices and high score for stable ones', () => {
    const degradedScore = calculateSubPlanckFoamMatrixFitness(sampleLattices[1]);
    expect(degradedScore).toBe(0.0);

    const stableScore = calculateSubPlanckFoamMatrixFitness(sampleLattices[0]);
    expect(stableScore).toBeGreaterThan(0.80);
  });

  it('plans optimal 200,000,000 batch workload dispatch across stable sub-planck foam lattices', () => {
    const plan = planSubPlanckBatchDispatch(sampleLattices, 200_000_000, 0.8);

    expect(plan.targetLatticeRef).toBe('LATTICE-SUB-PLANCK-01');
    expect(plan.assignedWorkloads).toBe(200_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(500_000); // 200M * 2.5 / 1000 = 500,000 PB
    expect(plan.planckDriftFs).toBe(0.8);
    expect(plan.dispatchHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects dispatch if relativistic clock drift exceeds 1 fs limit', () => {
    expect(() =>
      planSubPlanckBatchDispatch(sampleLattices, 200_000_000, 1.5)
    ).toThrow(/Sub-Planck relativistic clock drift 1.5 fs exceeds allowable threshold 1 fs/);
  });

  it('rejects dispatch if no stable lattices exist', () => {
    const unstableOnly = [sampleLattices[1]];
    expect(() => planSubPlanckBatchDispatch(unstableOnly, 200_000_000)).toThrow(
      /Zero stable sub-planck quantum foam lattices available/
    );
  });
});
