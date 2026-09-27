/**
 * @file queccaflop-scheduler-engine.test.ts
 * @layer tree/compute
 * @description Unit tests for QueccaFLOP photonic-quantum grid scheduling and batch dispatching.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateQueccaGridFitness,
  planQueccaBatchDispatch,
} from '../queccaflop-scheduler-engine';
import type { QueccaflopComputeGrid } from '@/seed/types/queccaflop-nexus';

describe('QueccaflopSchedulerEngine', () => {
  const sampleGridAlpha: QueccaflopComputeGrid = {
    gridNodeId: 'grid-alpha-orbital',
    datacenterLocation: 'Lagrange Point L1 Orbital Station',
    peakQueccaflops: 1.25,
    activePhotonicCores: 200_000_000,
    coherentQubitCount: 50_000_000,
    opticalBackplaneLatencyNs: 12.5,
    thermalCopRatio: 8.5,
    femtosecondClockDriftFs: 85.0,
    status: 'ONLINE_SUPERCONDUCTING',
    gridAvailabilityScore: 0.99999999999,
  };

  const sampleGridBeta: QueccaflopComputeGrid = {
    gridNodeId: 'grid-beta-terrestrial',
    datacenterLocation: 'Atacama Sub-Cryo Facility',
    peakQueccaflops: 1.05,
    activePhotonicCores: 180_000_000,
    coherentQubitCount: 40_000_000,
    opticalBackplaneLatencyNs: 14.8,
    thermalCopRatio: 8.1,
    femtosecondClockDriftFs: 110.0,
    status: 'ONLINE_SUPERCONDUCTING',
    gridAvailabilityScore: 0.99999999999,
  };

  const sampleGridMaintenance: QueccaflopComputeGrid = {
    ...sampleGridBeta,
    gridNodeId: 'grid-gamma-maint',
    status: 'MAINTENANCE_CRYO_CYCLE',
  };

  it('calculates multi-dimensional fitness score and rejects non-superconducting grids', () => {
    const fitnessAlpha = calculateQueccaGridFitness(sampleGridAlpha);
    const fitnessBeta = calculateQueccaGridFitness(sampleGridBeta);
    const fitnessMaint = calculateQueccaGridFitness(sampleGridMaintenance);

    expect(fitnessAlpha).toBeGreaterThan(0);
    expect(fitnessBeta).toBeGreaterThan(0);
    expect(fitnessAlpha).toBeGreaterThan(fitnessBeta); // Alpha has higher queccaflops and lower latency
    expect(fitnessMaint).toBe(0.0);
  });

  it('plans 2,000,000 workload dispatch to the optimal online grid', () => {
    const dispatch = planQueccaBatchDispatch([sampleGridAlpha, sampleGridBeta], 2_000_000, 95.0);

    expect(dispatch.targetGridId).toBe('grid-alpha-orbital');
    expect(dispatch.assignedWorkloads).toBe(2_000_000);
    expect(dispatch.totalOpticalPetabytes).toBe(4000);
    expect(dispatch.femtosecondDriftFs).toBe(95.0);
    expect(dispatch.dispatchHash).toHaveLength(64);
  });

  it('throws error when no online grids are available or clock drift exceeds 500 fs', () => {
    expect(() => planQueccaBatchDispatch([sampleGridMaintenance], 2_000_000, 50.0)).toThrow(
      'Zero online superconducting QueccaFLOP grids available for dispatch'
    );

    expect(() => planQueccaBatchDispatch([sampleGridAlpha], 2_000_000, 600.0)).toThrow(
      'Femtosecond relativistic clock drift 600 fs exceeds allowable threshold 500 fs'
    );
  });
});
