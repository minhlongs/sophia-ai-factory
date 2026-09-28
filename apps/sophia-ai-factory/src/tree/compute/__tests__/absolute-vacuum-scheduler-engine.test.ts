/**
 * @file absolute-vacuum-scheduler-engine.test.ts
 * @layer tree/compute/__tests__
 * @description Unit tests for Absolute Vacuum Singularity Mesh & 800M Workload Dispatching.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateAbsoluteVacuumMeshFitness,
  planAbsoluteVacuumBatchDispatch,
} from '../absolute-vacuum-scheduler-engine';
import type { AbsoluteVacuumSingularityMesh } from '@/seed/types/absolute-vacuum-singularity-nexus';

describe('Absolute Vacuum Singularity Scheduler Engine', () => {
  const primeMesh: AbsoluteVacuumSingularityMesh = {
    meshRef: 'ABSOLUTE_VACUUM_MESH_PRIME',
    locationSector: 'PAN_GALACTIC_CORE',
    vacuumNodesCount: 8_388_608,
    vacuumBusLatencyNanos: 0.01, // 0.01 ns < 0.02 ns
    vacuumBusBandwidthPetabytes: 2_000_000,
    relativisticClockDriftFs: 0.1, // 0.1 fs < 0.2 fs
    activeSentientPipelinesCount: 800_000_000,
    thermalCopRatio: 42.5, // > 40.0
    meshStatus: 'SINGULARITY_VACUUM_OPTIMAL',
    meshSignature: 'SIG_AV_PRIME_001',
  };

  it('calculates optimal fitness score for optimal Absolute Vacuum mesh', () => {
    const fitness = calculateAbsoluteVacuumMeshFitness(primeMesh);
    expect(fitness).toBeGreaterThan(0.80);
    expect(fitness).toBeLessThanOrEqual(1.0);
  });

  it('returns zero fitness for degraded or un-stabilized meshes', () => {
    const degradedMesh: AbsoluteVacuumSingularityMesh = {
      ...primeMesh,
      meshStatus: 'DEGRADED_THERMAL_DECAY',
    };

    const fitness = calculateAbsoluteVacuumMeshFitness(degradedMesh);
    expect(fitness).toBe(0.0);
  });

  it('plans dispatch for 800,000,000 sentient workloads across optimal mesh with sub-0.2 fs clock drift', () => {
    const backupMesh: AbsoluteVacuumSingularityMesh = {
      ...primeMesh,
      meshRef: 'ABSOLUTE_VACUUM_MESH_BACKUP',
      vacuumBusLatencyNanos: 0.018,
      thermalCopRatio: 40.5,
    };

    const plan = planAbsoluteVacuumBatchDispatch([backupMesh, primeMesh], 800_000_000, 0.15);

    expect(plan.targetMeshRef).toBe('ABSOLUTE_VACUUM_MESH_PRIME');
    expect(plan.assignedWorkloads).toBe(800_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(2_000_000); // 2,000,000 PB
    expect(plan.relativisticDriftFs).toBe(0.15);
    expect(plan.dispatchHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects dispatch when clock drift exceeds 0.2 fs limit or no optimal mesh exists', () => {
    expect(() => planAbsoluteVacuumBatchDispatch([primeMesh], 800_000_000, 0.35)).toThrow(
      'exceeds allowable threshold'
    );

    const degradedMesh: AbsoluteVacuumSingularityMesh = {
      ...primeMesh,
      meshStatus: 'WORKLOAD_SATURATED',
    };
    expect(() => planAbsoluteVacuumBatchDispatch([degradedMesh], 800_000_000, 0.1)).toThrow(
      'Zero optimal absolute vacuum singularity meshes'
    );
  });
});
