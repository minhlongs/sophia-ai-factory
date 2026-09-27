/**
 * @file ronanflop-optical-engine.test.ts
 * @description Unit tests for RonanFLOP optical grid fitness scoring and dispatch planning.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateOpticalGridFitness,
  planOpticalBatchDispatch,
} from '../ronanflop-optical-engine';
import type { RonanflopComputeGrid } from '@/seed/types/ronanflop-matrix';

describe('RonanFLOP Optical-Quantum Compute Engine', () => {
  const sampleGrids: RonanflopComputeGrid[] = [
    {
      id: 'grid-1',
      gridNodeId: 'GEO_ORBIT_ALPHA',
      locationSector: 'GEO_STATIONARY_ORBIT',
      peakRonanflops: 2.4,
      opticalBackplaneLatencyNs: 25.0, // 25 ns (fast)
      coherentQubitCount: 131_072, // 128K qubits
      gridAvailabilityScore: 0.999,
      thermalCopRatio: 7.2,
      status: 'ONLINE_SUPERCONDUCTING',
      createdAt: '2026-09-27T00:00:00Z',
    },
    {
      id: 'grid-2',
      gridNodeId: 'LUNAR_BETA',
      locationSector: 'LUNAR_GATEWAY',
      peakRonanflops: 1.5,
      opticalBackplaneLatencyNs: 45.0,
      coherentQubitCount: 65_536,
      gridAvailabilityScore: 0.99,
      thermalCopRatio: 6.6,
      status: 'ONLINE_SUPERCONDUCTING',
      createdAt: '2026-09-27T00:00:00Z',
    },
    {
      id: 'grid-3',
      gridNodeId: 'OFFLINE_GAMMA',
      locationSector: 'POLAR_SUBSEA_RING',
      peakRonanflops: 3.0,
      opticalBackplaneLatencyNs: 10.0,
      coherentQubitCount: 262_144,
      gridAvailabilityScore: 0.0,
      thermalCopRatio: 8.0,
      status: 'MAINTENANCE_PURGE',
      createdAt: '2026-09-27T00:00:00Z',
    },
  ];

  it('1. Computes multi-dimensional optical grid fitness score', () => {
    const score1 = calculateOpticalGridFitness(sampleGrids[0]);
    const score2 = calculateOpticalGridFitness(sampleGrids[1]);
    const scoreOffline = calculateOpticalGridFitness(sampleGrids[2]);

    expect(score1).toBeGreaterThan(score2);
    expect(scoreOffline).toBe(0.0); // offline grid scores zero
  });

  it('2. Dispatches 1,000,000 workloads to the highest scoring online optical grid', () => {
    const plan = planOpticalBatchDispatch(sampleGrids, 1_000_000, 0.15);
    expect(plan.targetGridId).toBe('GEO_ORBIT_ALPHA');
    expect(plan.assignedWorkloads).toBe(1_000_000);
    expect(plan.totalOpticalPetabytes).toBe(2000.0);
    expect(plan.relativisticDriftPs).toBe(0.15);
    expect(plan.dispatchHash).toHaveLength(64);
  });
});
