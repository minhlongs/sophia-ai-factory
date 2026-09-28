/**
 * @file pan-dimensional-scheduler-engine.test.ts
 * @layer tree/compute/__tests__
 * @description Unit tests for Pan-Dimensional Quantum Foam Singularity Mesh & 4B Workload Dispatching.
 */

import { describe, expect, it } from 'vitest';
import {
  calculatePanDimensionalMeshFitness,
  planPanDimensionalBatchDispatch,
} from '../pan-dimensional-scheduler-engine';
import type { PanDimensionalQuantumSingularityMesh } from '@/seed/types/pan-dimensional-quantum-mesh-nexus';

describe('Pan-Dimensional Quantum Foam Scheduler Engine', () => {
  const sampleMesh: PanDimensionalQuantumSingularityMesh = {
    meshRef: 'PAN_MESH_ALPHA_001',
    locationSector: 'OMNIVERSE_CORE',
    quantumFoamNodesCount: 33_554_432,
    quantumBusLatencyNanos: 0.0005, // Sub-0.001 ns
    quantumBusBandwidthPetabytes: 10_000_000,
    relativisticClockDriftFs: 0.03, // Sub-0.05 fs
    activeSentientPipelinesCount: 4_000_000_000,
    thermalCopRatio: 52.5, // COP >= 50.0
    meshStatus: 'PAN_DIMENSIONAL_QUANTUM_OPTIMAL',
    meshSignature: 'a'.repeat(64),
  };

  it('calculates optimal multi-dimensional fitness score for compliant quantum mesh', () => {
    const fitness = calculatePanDimensionalMeshFitness(sampleMesh);
    expect(fitness).toBeGreaterThan(0.8);

    const degradedMesh: PanDimensionalQuantumSingularityMesh = {
      ...sampleMesh,
      meshStatus: 'DEGRADED_THERMAL_DECAY',
    };
    expect(calculatePanDimensionalMeshFitness(degradedMesh)).toBe(0.0);
  });

  it('plans synchronous batch dispatch for 4,000,000,000 sentient pipelines (10,000,000 PB)', () => {
    const plan = planPanDimensionalBatchDispatch([sampleMesh], 4_000_000_000, 0.03);

    expect(plan.targetMeshRef).toBe('PAN_MESH_ALPHA_001');
    expect(plan.assignedWorkloads).toBe(4_000_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(10_000_000);
    expect(plan.relativisticDriftFs).toBe(0.03);
    expect(plan.dispatchHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects batch dispatch when relativistic clock drift exceeds 0.05 femtoseconds', () => {
    expect(() =>
      planPanDimensionalBatchDispatch([sampleMesh], 4_000_000_000, 0.06)
    ).toThrow('exceeds allowable threshold 0.05 fs');
  });

  it('rejects batch dispatch when zero optimal pan-dimensional quantum meshes are available', () => {
    const saturatedMesh: PanDimensionalQuantumSingularityMesh = {
      ...sampleMesh,
      meshStatus: 'WORKLOAD_SATURATED',
    };

    expect(() =>
      planPanDimensionalBatchDispatch([saturatedMesh], 4_000_000_000, 0.03)
    ).toThrow('Zero optimal pan-dimensional quantum foam singularity meshes');
  });
});
