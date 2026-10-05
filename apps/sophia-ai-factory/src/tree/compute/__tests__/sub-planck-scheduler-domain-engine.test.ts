/**
 * @file sub-planck-scheduler-domain-engine.test.ts
 * @layer tree/compute
 * @description Unit tests for canonical Sub-Planck Scheduler Domain Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateParameterizedMeshFitness,
  planParameterizedBatchDispatch,
} from '../sub-planck-scheduler-domain-engine';

describe('SubPlanckSchedulerDomainEngine (Canonical Parameterized Compute Engine)', () => {
  it('calculates weighted composite fitness score for stable mesh', () => {
    const score = calculateParameterizedMeshFitness(
      {
        status: 'ANYONIC_FLUX_STABLE',
        latencyNanos: 0.35,
        nodeCount: 1_048_576,
        copRatio: 22.0,
        bandwidthPetabytes: 150_000,
      },
      {
        maxLatencyNs: 0.8,
        minNodes: 1_000_000,
        minCop: 20.0,
        maxBandwidthPb: 100_000,
      }
    );

    expect(score).toBeGreaterThan(0.8);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('returns 0.0 fitness for offline or degraded mesh', () => {
    const score = calculateParameterizedMeshFitness(
      {
        status: 'DEGRADED',
        latencyNanos: 0.35,
        nodeCount: 1_048_576,
        copRatio: 22.0,
        bandwidthPetabytes: 150_000,
      },
      {
        maxLatencyNs: 0.8,
        minNodes: 1_000_000,
        minCop: 20.0,
      }
    );

    expect(score).toBe(0.0);
  });

  it('plans batch dispatch to highest fitness stable mesh', () => {
    const meshes = [
      { matrixRef: 'MESH_1', vacuumMatrixStatus: 'ANYONIC_FLUX_STABLE', score: 0.85 },
      { matrixRef: 'MESH_2', vacuumMatrixStatus: 'ANYONIC_FLUX_STABLE', score: 0.95 },
    ];

    const plan = planParameterizedBatchDispatch(meshes, 40_000_000, 7.0, {
      maxClockDriftFs: 10.0,
      fitnessFn: (m) => m.score,
      bandwidthPerWorkloadPb: 0.0025,
      hashPrefix: 'FEMTOSECOND_DISPATCH',
    });

    expect(plan.targetMatrixRef).toBe('MESH_2');
    expect(plan.assignedWorkloads).toBe(40_000_000);
    expect(plan.totalBandwidthPetabytes).toBe(100_000);
    expect(plan.dispatchHash).toHaveLength(64);
  });

  it('throws error when measured clock drift exceeds maximum allowed', () => {
    const meshes = [
      { matrixRef: 'MESH_1', vacuumMatrixStatus: 'ANYONIC_FLUX_STABLE' },
    ];

    expect(() =>
      planParameterizedBatchDispatch(meshes, 1000, 15.0, {
        maxClockDriftFs: 10.0,
      })
    ).toThrow(/clock drift/i);
  });
});
