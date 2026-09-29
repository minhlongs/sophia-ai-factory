/**
 * @file inter-galactic-scheduler-engine.test.ts
 * @layer tree/compute/__tests__
 * @description Unit tests for Omni-Cosmic Sub-Planck Foam Singularity Mesh & 20B Workload Dispatching.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateInterGalacticMeshFitness,
  planInterGalacticBatchDispatch,
} from '../inter-galactic-scheduler-engine';
import type { InterGalacticQuantumSingularityMesh } from '@/seed/types/inter-galactic-quantum-mesh-nexus';

describe('Omni-Cosmic Sub-Planck Scheduler Engine', () => {
  const sampleMesh: InterGalacticQuantumSingularityMesh = {
    meshRef: 'INTER_GALACTIC_MESH_ALPHA_001',
    locationSector: 'INTER_GALACTIC_CORE',
    subPlanckFoamNodesCount: 134_217_728, // 2^27 nodes
    quantumBusLatencyNanos: 0.0001, // Sub-0.0002 ns
    quantumBusBandwidthPetabytes: 50_000_000,
    relativisticClockDriftFs: 0.005, // Sub-0.01 fs
    activeSentientPipelinesCount: 20_000_000_000,
    thermalCopRatio: 78.5, // COP >= 75.0
    meshStatus: 'OMNI_COSMIC_SUB_PLANCK_OPTIMAL',
    meshSignature: 'c'.repeat(64),
  };

  it('calculates optimal multi-dimensional fitness score for compliant quantum mesh', () => {
    const fitness = calculateInterGalacticMeshFitness(sampleMesh);
    expect(fitness).toBeGreaterThan(0.8);

    const degradedMesh: InterGalacticQuantumSingularityMesh = {
      ...sampleMesh,
      meshStatus: 'DEGRADED_THERMAL_DECAY',
    };
    expect(calculateInterGalacticMeshFitness(degradedMesh)).toBe(0.0);
  });

  it('plans synchronous batch dispatch for 20,000,000,000 sentient pipelines (50,000,000 PB)', () => {
    const plan = planInterGalacticBatchDispatch([sampleMesh], 20_000_000_000, 0.005);

    expect(plan.targetMeshRef).toBe('INTER_GALACTIC_MESH_ALPHA_001');
    expect(plan.assignedWorkloads).toBe(20_000_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(50_000_000);
    expect(plan.relativisticDriftFs).toBe(0.005);
    expect(plan.dispatchHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects batch dispatch when relativistic clock drift exceeds 0.01 femtoseconds', () => {
    expect(() =>
      planInterGalacticBatchDispatch([sampleMesh], 20_000_000_000, 0.015)
    ).toThrow('exceeds allowable threshold 0.01 fs');
  });

  it('rejects batch dispatch when zero optimal omni-cosmic sub-planck meshes are available', () => {
    const saturatedMesh: InterGalacticQuantumSingularityMesh = {
      ...sampleMesh,
      meshStatus: 'WORKLOAD_SATURATED',
    };

    expect(() =>
      planInterGalacticBatchDispatch([saturatedMesh], 20_000_000_000, 0.005)
    ).toThrow('Zero optimal omni-cosmic sub-planck foam singularity meshes');
  });
});
