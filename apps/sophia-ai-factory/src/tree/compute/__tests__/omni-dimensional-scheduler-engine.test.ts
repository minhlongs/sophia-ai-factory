/**
 * @file omni-dimensional-scheduler-engine.test.ts
 * @layer tree/compute/__tests__
 * @description Unit tests for Omni-Dimensional Planck-Scale Singularity Mesh & 10B Workload Dispatching.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateOmniDimensionalMeshFitness,
  planOmniDimensionalBatchDispatch,
} from '../omni-dimensional-scheduler-engine';
import type { OmniDimensionalQuantumSingularityMesh } from '@/seed/types/omni-dimensional-quantum-mesh-nexus';

describe('Omni-Dimensional Planck Scheduler Engine', () => {
  const sampleMesh: OmniDimensionalQuantumSingularityMesh = {
    meshRef: 'OMNI_MESH_ALPHA_001',
    locationSector: 'OMNI_COSMIC_CORE',
    planckFoamNodesCount: 67_108_864, // 2^26 nodes
    quantumBusLatencyNanos: 0.0002, // Sub-0.0005 ns
    quantumBusBandwidthPetabytes: 25_000_000,
    relativisticClockDriftFs: 0.01, // Sub-0.02 fs
    activeSentientPipelinesCount: 10_000_000_000,
    thermalCopRatio: 62.5, // COP >= 60.0
    meshStatus: 'OMNI_DIMENSIONAL_PLANCK_OPTIMAL',
    meshSignature: 'c'.repeat(64),
  };

  it('calculates optimal multi-dimensional fitness score for compliant quantum mesh', () => {
    const fitness = calculateOmniDimensionalMeshFitness(sampleMesh);
    expect(fitness).toBeGreaterThan(0.8);

    const degradedMesh: OmniDimensionalQuantumSingularityMesh = {
      ...sampleMesh,
      meshStatus: 'DEGRADED_THERMAL_DECAY',
    };
    expect(calculateOmniDimensionalMeshFitness(degradedMesh)).toBe(0.0);
  });

  it('plans synchronous batch dispatch for 10,000,000,000 sentient pipelines (25,000,000 PB)', () => {
    const plan = planOmniDimensionalBatchDispatch([sampleMesh], 10_000_000_000, 0.01);

    expect(plan.targetMeshRef).toBe('OMNI_MESH_ALPHA_001');
    expect(plan.assignedWorkloads).toBe(10_000_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(25_000_000);
    expect(plan.relativisticDriftFs).toBe(0.01);
    expect(plan.dispatchHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects batch dispatch when relativistic clock drift exceeds 0.02 femtoseconds', () => {
    expect(() =>
      planOmniDimensionalBatchDispatch([sampleMesh], 10_000_000_000, 0.03)
    ).toThrow('exceeds allowable threshold 0.02 fs');
  });

  it('rejects batch dispatch when zero optimal omni-dimensional planck meshes are available', () => {
    const saturatedMesh: OmniDimensionalQuantumSingularityMesh = {
      ...sampleMesh,
      meshStatus: 'WORKLOAD_SATURATED',
    };

    expect(() =>
      planOmniDimensionalBatchDispatch([saturatedMesh], 10_000_000_000, 0.01)
    ).toThrow('Zero optimal omni-dimensional planck-scale foam singularity meshes');
  });
});
