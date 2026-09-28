/**
 * @file transcendental-vacuum-scheduler-engine.test.ts
 * @layer tree/compute/__tests__
 * @description Unit tests for Transcendental Vacuum Singularity Mesh & 2B Workload Dispatching.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateTranscendentalVacuumMeshFitness,
  planTranscendentalVacuumBatchDispatch,
} from '../transcendental-vacuum-scheduler-engine';
import type { TranscendentalVacuumSingularityMesh } from '@/seed/types/transcendental-vacuum-singularity-nexus';

describe('Transcendental Vacuum Singularity Mesh Scheduler Engine', () => {
  const sampleMeshAlpha: TranscendentalVacuumSingularityMesh = {
    meshRef: 'MESH_VACUUM_ALPHA',
    locationSector: 'OMNIVERSE_CORE',
    vacuumNodesCount: 16_777_216,
    vacuumBusLatencyNanos: 0.005, // 0.005 ns < 0.01 ns
    relativisticClockDriftFs: 0.08, // 0.08 fs <= 0.1 fs
    thermalCopRatio: 48.5, // > 45.0
    vacuumBusBandwidthPetabytes: 5_500_000,
    activeSentientPipelinesCount: 1_000_000_000,
    meshStatus: 'TRANSCENDENTAL_VACUUM_OPTIMAL',
    meshSignature: 'a'.repeat(64),
  };

  const sampleMeshBeta: TranscendentalVacuumSingularityMesh = {
    meshRef: 'MESH_VACUUM_BETA',
    locationSector: 'TRANSCENDENTAL_SINGULARITY_WELL',
    vacuumNodesCount: 12_000_000,
    vacuumBusLatencyNanos: 0.008,
    relativisticClockDriftFs: 0.09,
    thermalCopRatio: 46.0,
    vacuumBusBandwidthPetabytes: 4_000_000,
    activeSentientPipelinesCount: 800_000_000,
    meshStatus: 'TRANSCENDENTAL_VACUUM_OPTIMAL',
    meshSignature: 'b'.repeat(64),
  };

  it('calculates higher fitness score for lower latency and superior thermal COP mesh', () => {
    const scoreAlpha = calculateTranscendentalVacuumMeshFitness(sampleMeshAlpha);
    const scoreBeta = calculateTranscendentalVacuumMeshFitness(sampleMeshBeta);

    expect(scoreAlpha).toBeGreaterThan(0.80);
    expect(scoreAlpha).toBeGreaterThan(scoreBeta);

    const degradedMesh: TranscendentalVacuumSingularityMesh = {
      ...sampleMeshAlpha,
      meshStatus: 'DEGRADED_THERMAL_DECAY',
    };
    expect(calculateTranscendentalVacuumMeshFitness(degradedMesh)).toBe(0.0);
  });

  it('successfully plans batch dispatch of 2,000,000,000 workloads across optimal mesh', () => {
    const plan = planTranscendentalVacuumBatchDispatch([sampleMeshAlpha, sampleMeshBeta], 2_000_000_000, 0.08);

    expect(plan.targetMeshRef).toBe('MESH_VACUUM_ALPHA');
    expect(plan.assignedWorkloads).toBe(2_000_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(5_000_000); // 5,000,000 Petabytes
    expect(plan.relativisticDriftFs).toBe(0.08);
    expect(plan.dispatchHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects dispatch when relativistic clock drift exceeds 0.1 fs threshold', () => {
    expect(() =>
      planTranscendentalVacuumBatchDispatch([sampleMeshAlpha], 2_000_000_000, 0.15)
    ).toThrow('relativistic clock drift 0.15 fs exceeds allowable threshold 0.1 fs');
  });

  it('throws error when no optimal meshes are available', () => {
    const offlineMesh: TranscendentalVacuumSingularityMesh = {
      ...sampleMeshAlpha,
      meshStatus: 'DEGRADED_THERMAL_DECAY',
    };

    expect(() => planTranscendentalVacuumBatchDispatch([offlineMesh])).toThrow(
      'Zero optimal transcendental vacuum singularity meshes available for dispatch'
    );
  });
});
