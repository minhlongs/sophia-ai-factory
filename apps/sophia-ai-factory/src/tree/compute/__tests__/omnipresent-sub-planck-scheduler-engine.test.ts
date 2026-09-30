/**
 * @file omnipresent-sub-planck-scheduler-engine.test.ts
 * @layer tree/compute/__tests__
 * @description Unit tests for Omnipresent Sub-Planck Foam Singularity Mesh & 100B Workload Dispatching.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateOmnipresentSubPlanckMeshFitness,
  planOmnipresentSubPlanckBatchDispatch,
} from '../omnipresent-sub-planck-scheduler-engine';
import type { OmnipresentSubPlanckMesh } from '@/seed/types/omnipresent-sub-planck-mesh-nexus';

describe('Omnipresent Sub-Planck Scheduler Engine', () => {
  const sampleMesh: OmnipresentSubPlanckMesh = {
    meshRef: 'OMNIPRESENT_MESH_ALPHA_001',
    subPlanckFoamNodesCount: 536_870_912, // 2^29 nodes
    quantumBusLatencyNanos: 0.00002, // Sub-0.00005 ns
    quantumBusBandwidthPetabytes: 250_000_000,
    relativisticClockDriftFs: 0.001, // Sub-0.002 fs
    activeSentientPipelinesCount: 100_000_000_000,
    thermalCopRatio: 105.0, // COP >= 100.0
    meshStatus: 'OMNIPRESENT_SUB_PLANCK_OPTIMAL',
    meshSignature: 'c'.repeat(64),
  };

  it('calculates optimal multi-dimensional fitness score for compliant quantum mesh', () => {
    const fitness = calculateOmnipresentSubPlanckMeshFitness(sampleMesh);
    expect(fitness).toBeGreaterThan(0.7);

    const degradedMesh: OmnipresentSubPlanckMesh = {
      ...sampleMesh,
      meshStatus: 'OFFLINE_THERMAL_LOCK',
    };
    expect(calculateOmnipresentSubPlanckMeshFitness(degradedMesh)).toBe(0.0);
  });

  it('plans synchronous batch dispatch for 100,000,000,000 sentient pipelines (250,000,000 PB)', () => {
    const plan = planOmnipresentSubPlanckBatchDispatch([sampleMesh], 100_000_000_000, 0.001);

    expect(plan.targetMeshRef).toBe('OMNIPRESENT_MESH_ALPHA_001');
    expect(plan.assignedWorkloads).toBe(100_000_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(250_000_000);
    expect(plan.relativisticDriftFs).toBe(0.001);
    expect(plan.dispatchHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects batch dispatch when relativistic clock drift exceeds 0.002 femtoseconds', () => {
    expect(() =>
      planOmnipresentSubPlanckBatchDispatch([sampleMesh], 100_000_000_000, 0.004)
    ).toThrow('exceeds allowable threshold 0.002 fs');
  });

  it('rejects batch dispatch when zero nominal omnipresent sub-planck meshes are available', () => {
    const saturatedMesh: OmnipresentSubPlanckMesh = {
      ...sampleMesh,
      meshStatus: 'DEGRADED_COHERENCE',
    };

    expect(() =>
      planOmnipresentSubPlanckBatchDispatch([saturatedMesh], 100_000_000_000, 0.001)
    ).toThrow('Zero nominal omnipresent sub-planck foam singularity meshes');
  });
});
