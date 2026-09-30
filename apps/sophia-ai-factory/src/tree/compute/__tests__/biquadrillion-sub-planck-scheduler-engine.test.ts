/**
 * @file biquadrillion-sub-planck-scheduler-engine.test.ts
 * @layer tree/compute/__tests__
 * @description Unit tests for Bi-Quadrillion Sub-Planck Foam Singularity Mesh & 800B Workload Dispatching.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateBiquadrillionSubPlanckMeshFitness,
  planBiquadrillionSubPlanckBatchDispatch,
} from '../biquadrillion-sub-planck-scheduler-engine';
import type { BiquadrillionSubPlanckMesh } from '@/seed/types/biquadrillion-sub-planck-mesh-nexus';

describe('Bi-Quadrillion Sub-Planck Scheduler Engine', () => {
  const sampleMesh: BiquadrillionSubPlanckMesh = {
    meshRef: 'BIQUADRILLION_MESH_ALPHA_001',
    subPlanckFoamNodesCount: 4_294_967_296, // 2^32 nodes
    quantumBusLatencyNanos: 0.0000005, // Sub-0.000001 ns
    quantumBusBandwidthPetabytes: 2_000_000_000,
    relativisticClockDriftFs: 0.00002, // Sub-0.00005 fs
    activeSentientPipelinesCount: 800_000_000_000,
    thermalCopRatio: 195.0, // COP >= 180.0
    meshStatus: 'BIQUADRILLION_SUB_PLANCK_OPTIMAL',
    meshSignature: 'e'.repeat(64),
  };

  it('calculates optimal multi-dimensional fitness score for compliant quantum mesh', () => {
    const fitness = calculateBiquadrillionSubPlanckMeshFitness(sampleMesh);
    expect(fitness).toBeGreaterThan(0.7);

    const degradedMesh: BiquadrillionSubPlanckMesh = {
      ...sampleMesh,
      meshStatus: 'OFFLINE_THERMAL_LOCK',
    };
    expect(calculateBiquadrillionSubPlanckMeshFitness(degradedMesh)).toBe(0.0);
  });

  it('plans synchronous batch dispatch for 800,000,000,000 sentient pipelines (2,000,000,000 PB)', () => {
    const plan = planBiquadrillionSubPlanckBatchDispatch([sampleMesh], 800_000_000_000, 0.00002);

    expect(plan.targetMeshRef).toBe('BIQUADRILLION_MESH_ALPHA_001');
    expect(plan.assignedWorkloads).toBe(800_000_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(2_000_000_000);
    expect(plan.relativisticDriftFs).toBe(0.00002);
    expect(plan.dispatchHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects batch dispatch when relativistic clock drift exceeds 0.00005 femtoseconds', () => {
    expect(() =>
      planBiquadrillionSubPlanckBatchDispatch([sampleMesh], 800_000_000_000, 0.0001)
    ).toThrow('exceeds allowable threshold 0.00005 fs');
  });

  it('rejects batch dispatch when zero nominal biquadrillion sub-planck meshes are available', () => {
    const saturatedMesh: BiquadrillionSubPlanckMesh = {
      ...sampleMesh,
      meshStatus: 'DEGRADED_COHERENCE',
    };

    expect(() =>
      planBiquadrillionSubPlanckBatchDispatch([saturatedMesh], 800_000_000_000, 0.00002)
    ).toThrow('Zero nominal biquadrillion sub-planck foam singularity meshes');
  });
});
