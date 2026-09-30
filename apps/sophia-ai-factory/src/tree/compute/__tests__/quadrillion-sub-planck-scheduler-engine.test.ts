/**
 * @file quadrillion-sub-planck-scheduler-engine.test.ts
 * @layer tree/compute/__tests__
 * @description Unit tests for Quadrillion Sub-Planck Foam Singularity Mesh & 400B Workload Dispatching.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateQuadrillionSubPlanckMeshFitness,
  planQuadrillionSubPlanckBatchDispatch,
} from '../quadrillion-sub-planck-scheduler-engine';
import type { QuadrillionSubPlanckMesh } from '@/seed/types/quadrillion-sub-planck-mesh-nexus';

describe('Quadrillion Sub-Planck Scheduler Engine', () => {
  const sampleMesh: QuadrillionSubPlanckMesh = {
    meshRef: 'QUADRILLION_MESH_ALPHA_001',
    subPlanckFoamNodesCount: 2_147_483_648, // 2^31 nodes
    quantumBusLatencyNanos: 0.000002, // Sub-0.000005 ns
    quantumBusBandwidthPetabytes: 1_000_000_000,
    relativisticClockDriftFs: 0.0001, // Sub-0.0002 fs
    activeSentientPipelinesCount: 400_000_000_000,
    thermalCopRatio: 160.0, // COP >= 150.0
    meshStatus: 'QUADRILLION_SUB_PLANCK_OPTIMAL',
    meshSignature: 'e'.repeat(64),
  };

  it('calculates optimal multi-dimensional fitness score for compliant quantum mesh', () => {
    const fitness = calculateQuadrillionSubPlanckMeshFitness(sampleMesh);
    expect(fitness).toBeGreaterThan(0.7);

    const degradedMesh: QuadrillionSubPlanckMesh = {
      ...sampleMesh,
      meshStatus: 'OFFLINE_THERMAL_LOCK',
    };
    expect(calculateQuadrillionSubPlanckMeshFitness(degradedMesh)).toBe(0.0);
  });

  it('plans synchronous batch dispatch for 400,000,000,000 sentient pipelines (1,000,000,000 PB)', () => {
    const plan = planQuadrillionSubPlanckBatchDispatch([sampleMesh], 400_000_000_000, 0.0001);

    expect(plan.targetMeshRef).toBe('QUADRILLION_MESH_ALPHA_001');
    expect(plan.assignedWorkloads).toBe(400_000_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(1_000_000_000);
    expect(plan.relativisticDriftFs).toBe(0.0001);
    expect(plan.dispatchHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects batch dispatch when relativistic clock drift exceeds 0.0002 femtoseconds', () => {
    expect(() =>
      planQuadrillionSubPlanckBatchDispatch([sampleMesh], 400_000_000_000, 0.0005)
    ).toThrow('exceeds allowable threshold 0.0002 fs');
  });

  it('rejects batch dispatch when zero nominal quadrillion sub-planck meshes are available', () => {
    const saturatedMesh: QuadrillionSubPlanckMesh = {
      ...sampleMesh,
      meshStatus: 'DEGRADED_COHERENCE',
    };

    expect(() =>
      planQuadrillionSubPlanckBatchDispatch([saturatedMesh], 400_000_000_000, 0.0001)
    ).toThrow('Zero nominal quadrillion sub-planck foam singularity meshes');
  });
});
