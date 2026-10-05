/**
 * @file centumquintillion-sub-planck-scheduler-engine.test.ts
 * @layer tree/compute/__tests__
 * @description Unit tests for Centum-Quintillion Sub-Planck Foam Singularity Scheduler Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateCentumquintillionSubPlanckMeshFitness,
  planCentumquintillionSubPlanckBatchDispatch,
} from '../centumquintillion-sub-planck-scheduler-engine';
import type { CentumquintillionSubPlanckMesh } from '@/seed/types/centumquintillion-sub-planck-mesh-nexus';

describe('Centum-Quintillion Sub-Planck Scheduler Engine', () => {
  const nominalMesh: CentumquintillionSubPlanckMesh = {
    meshRef: 'MESH-CENTUM-001',
    subPlanckFoamNodesCount: 562_949_953_421_312, // 2^49
    quantumBusLatencyNanos: 0.00000000000005, // 0.05 attoseconds
    quantumBusBandwidthPetabytes: 1_000_000_000_000_000, // 1.0 Ronnabyte
    relativisticClockDriftFs: 0.000000000001, // 1.0 yoctosecond
    activeSentientPipelinesCount: 400_000_000_000_000_000,
    thermalCopRatio: 3000.0,
    meshStatus: 'CENTUMQUINTILLION_SUB_PLANCK_OPTIMAL',
    meshSignature: 'sig-mesh-centum-001',
  };

  it('calculates high fitness score (>0.6) for optimal singularity mesh', () => {
    const fitness = calculateCentumquintillionSubPlanckMeshFitness(nominalMesh);
    expect(fitness).toBeGreaterThan(0.6);
  });

  it('returns zero fitness for degraded or offline meshes', () => {
    const degradedMesh: CentumquintillionSubPlanckMesh = {
      ...nominalMesh,
      meshStatus: 'DEGRADED_COHERENCE',
    };
    const fitness = calculateCentumquintillionSubPlanckMeshFitness(degradedMesh);
    expect(fitness).toBe(0.0);
  });

  it('plans optimal dispatch for 400.0 Quadrillion workloads with 1,000,000 Zetabytes aggregate bandwidth', () => {
    const plan = planCentumquintillionSubPlanckBatchDispatch([nominalMesh]);
    expect(plan.targetMeshRef).toBe('MESH-CENTUM-001');
    expect(plan.assignedWorkloads).toBe(400_000_000_000_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(1_000_000_000_000_000);
    expect(plan.relativisticDriftFs).toBe(0.000000000001);
    expect(plan.dispatchHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
