/**
 * @file infinite-sub-planck-scheduler-engine.test.ts
 * @layer tree/compute/__tests__
 * @description Unit tests for Infinite Sub-Planck Foam Singularity Mesh & 200B Workload Dispatching.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateInfiniteSubPlanckMeshFitness,
  planInfiniteSubPlanckBatchDispatch,
} from '../infinite-sub-planck-scheduler-engine';
import type { InfiniteSubPlanckMesh } from '@/seed/types/infinite-sub-planck-mesh-nexus';

describe('Infinite Sub-Planck Scheduler Engine', () => {
  const sampleMesh: InfiniteSubPlanckMesh = {
    meshRef: 'INFINITE_MESH_ALPHA_001',
    subPlanckFoamNodesCount: 1_073_741_824, // 2^30 nodes
    quantumBusLatencyNanos: 0.00001, // Sub-0.00002 ns
    quantumBusBandwidthPetabytes: 500_000_000,
    relativisticClockDriftFs: 0.0005, // Sub-0.001 fs
    activeSentientPipelinesCount: 200_000_000_000,
    thermalCopRatio: 125.0, // COP >= 120.0
    meshStatus: 'INFINITE_SUB_PLANCK_OPTIMAL',
    meshSignature: 'd'.repeat(64),
  };

  it('calculates optimal multi-dimensional fitness score for compliant quantum mesh', () => {
    const fitness = calculateInfiniteSubPlanckMeshFitness(sampleMesh);
    expect(fitness).toBeGreaterThan(0.7);

    const degradedMesh: InfiniteSubPlanckMesh = {
      ...sampleMesh,
      meshStatus: 'OFFLINE_THERMAL_LOCK',
    };
    expect(calculateInfiniteSubPlanckMeshFitness(degradedMesh)).toBe(0.0);
  });

  it('plans synchronous batch dispatch for 200,000,000,000 sentient pipelines (500,000,000 PB)', () => {
    const plan = planInfiniteSubPlanckBatchDispatch([sampleMesh], 200_000_000_000, 0.0005);

    expect(plan.targetMeshRef).toBe('INFINITE_MESH_ALPHA_001');
    expect(plan.assignedWorkloads).toBe(200_000_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(500_000_000);
    expect(plan.relativisticDriftFs).toBe(0.0005);
    expect(plan.dispatchHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects batch dispatch when relativistic clock drift exceeds 0.001 femtoseconds', () => {
    expect(() =>
      planInfiniteSubPlanckBatchDispatch([sampleMesh], 200_000_000_000, 0.002)
    ).toThrow('exceeds allowable threshold 0.001 fs');
  });

  it('rejects batch dispatch when zero nominal infinite sub-planck meshes are available', () => {
    const saturatedMesh: InfiniteSubPlanckMesh = {
      ...sampleMesh,
      meshStatus: 'DEGRADED_COHERENCE',
    };

    expect(() =>
      planInfiniteSubPlanckBatchDispatch([saturatedMesh], 200_000_000_000, 0.0005)
    ).toThrow('Zero nominal infinite sub-planck foam singularity meshes');
  });
});
