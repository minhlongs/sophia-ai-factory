/**
 * @file pentaquadrillion-sub-planck-scheduler-engine.test.ts
 * @layer tree/compute/__tests__
 * @description Unit tests for Penta-Quadrillion Sub-Planck Foam Singularity Mesh & 2T Workload Dispatching.
 */

import { describe, expect, it } from 'vitest';
import {
  calculatePentaquadrillionSubPlanckMeshFitness,
  planPentaquadrillionSubPlanckBatchDispatch,
} from '../pentaquadrillion-sub-planck-scheduler-engine';
import type { PentaquadrillionSubPlanckMesh } from '@/seed/types/pentaquadrillion-sub-planck-mesh-nexus';

describe('Penta-Quadrillion Sub-Planck Scheduler Engine', () => {
  const sampleMesh: PentaquadrillionSubPlanckMesh = {
    meshRef: 'PENTAQUADRILLION_MESH_ALPHA_001',
    subPlanckFoamNodesCount: 8_589_934_592, // 2^33 nodes
    quantumBusLatencyNanos: 0.00000005, // Sub-0.0000001 ns
    quantumBusBandwidthPetabytes: 5_000_000_000,
    relativisticClockDriftFs: 0.000005, // Sub-0.00001 fs
    activeSentientPipelinesCount: 2_000_000_000_000,
    thermalCopRatio: 240.0, // COP >= 220.0
    meshStatus: 'PENTAQUADRILLION_SUB_PLANCK_OPTIMAL',
    meshSignature: 'e'.repeat(64),
  };

  it('calculates optimal multi-dimensional fitness score for compliant quantum mesh', () => {
    const fitness = calculatePentaquadrillionSubPlanckMeshFitness(sampleMesh);
    expect(fitness).toBeGreaterThan(0.7);

    const degradedMesh: PentaquadrillionSubPlanckMesh = {
      ...sampleMesh,
      meshStatus: 'OFFLINE_THERMAL_LOCK',
    };
    expect(calculatePentaquadrillionSubPlanckMeshFitness(degradedMesh)).toBe(0.0);
  });

  it('plans synchronous batch dispatch for 2,000,000,000,000 sentient pipelines (5,000,000,000 PB)', () => {
    const plan = planPentaquadrillionSubPlanckBatchDispatch([sampleMesh], 2_000_000_000_000, 0.000005);

    expect(plan.targetMeshRef).toBe('PENTAQUADRILLION_MESH_ALPHA_001');
    expect(plan.assignedWorkloads).toBe(2_000_000_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(5_000_000_000);
    expect(plan.relativisticDriftFs).toBe(0.000005);
    expect(plan.dispatchHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects batch dispatch when relativistic clock drift exceeds 0.00001 femtoseconds', () => {
    expect(() =>
      planPentaquadrillionSubPlanckBatchDispatch([sampleMesh], 2_000_000_000_000, 0.00005)
    ).toThrow('exceeds allowable threshold 0.00001 fs');
  });

  it('rejects batch dispatch when zero nominal pentaquadrillion sub-planck meshes are available', () => {
    const saturatedMesh: PentaquadrillionSubPlanckMesh = {
      ...sampleMesh,
      meshStatus: 'DEGRADED_COHERENCE',
    };

    expect(() =>
      planPentaquadrillionSubPlanckBatchDispatch([saturatedMesh], 2_000_000_000_000, 0.000005)
    ).toThrow('Zero nominal pentaquadrillion sub-planck foam singularity meshes');
  });
});
