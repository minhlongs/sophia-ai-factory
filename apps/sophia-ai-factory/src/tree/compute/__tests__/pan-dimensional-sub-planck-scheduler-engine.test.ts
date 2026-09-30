/**
 * @file pan-dimensional-sub-planck-scheduler-engine.test.ts
 * @layer tree/compute/__tests__
 * @description Unit tests for Pan-Dimensional Sub-Planck Foam Singularity Mesh & 40B Workload Dispatching.
 */

import { describe, expect, it } from 'vitest';
import {
  calculatePanDimensionalSubPlanckMeshFitness,
  planPanDimensionalSubPlanckBatchDispatch,
} from '../pan-dimensional-sub-planck-scheduler-engine';
import type { PanDimensionalSubPlanckMesh } from '@/seed/types/pan-dimensional-sub-planck-mesh-nexus';

describe('Pan-Dimensional Sub-Planck Scheduler Engine', () => {
  const sampleMesh: PanDimensionalSubPlanckMesh = {
    meshRef: 'PAN_DIMENSIONAL_MESH_ALPHA_001',
    subPlanckFoamNodesCount: 268_435_456, // 2^28 nodes
    quantumBusLatencyNanos: 0.00005, // Sub-0.0001 ns
    quantumBusBandwidthPetabytes: 100_000_000,
    relativisticClockDriftFs: 0.0025, // Sub-0.005 fs
    activeSentientPipelinesCount: 40_000_000_000,
    thermalCopRatio: 92.5, // COP >= 90.0
    meshStatus: 'PAN_DIMENSIONAL_SUB_PLANCK_OPTIMAL',
    meshSignature: 'c'.repeat(64),
  };

  it('calculates optimal multi-dimensional fitness score for compliant quantum mesh', () => {
    const fitness = calculatePanDimensionalSubPlanckMeshFitness(sampleMesh);
    expect(fitness).toBeGreaterThan(0.7);

    const degradedMesh: PanDimensionalSubPlanckMesh = {
      ...sampleMesh,
      meshStatus: 'OFFLINE_THERMAL_LOCK',
    };
    expect(calculatePanDimensionalSubPlanckMeshFitness(degradedMesh)).toBe(0.0);
  });

  it('plans synchronous batch dispatch for 40,000,000,000 sentient pipelines (100,000,000 PB)', () => {
    const plan = planPanDimensionalSubPlanckBatchDispatch([sampleMesh], 40_000_000_000, 0.0025);

    expect(plan.targetMeshRef).toBe('PAN_DIMENSIONAL_MESH_ALPHA_001');
    expect(plan.assignedWorkloads).toBe(40_000_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(100_000_000);
    expect(plan.relativisticDriftFs).toBe(0.0025);
    expect(plan.dispatchHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects batch dispatch when relativistic clock drift exceeds 0.005 femtoseconds', () => {
    expect(() =>
      planPanDimensionalSubPlanckBatchDispatch([sampleMesh], 40_000_000_000, 0.008)
    ).toThrow('exceeds allowable threshold 0.005 fs');
  });

  it('rejects batch dispatch when zero nominal pan-dimensional sub-planck meshes are available', () => {
    const saturatedMesh: PanDimensionalSubPlanckMesh = {
      ...sampleMesh,
      meshStatus: 'DEGRADED_COHERENCE',
    };

    expect(() =>
      planPanDimensionalSubPlanckBatchDispatch([saturatedMesh], 40_000_000_000, 0.0025)
    ).toThrow('Zero nominal pan-dimensional sub-planck foam singularity meshes');
  });
});
