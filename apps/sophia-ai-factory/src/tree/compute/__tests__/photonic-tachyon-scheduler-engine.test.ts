/**
 * @file photonic-tachyon-scheduler-engine.test.ts
 * @layer tree/compute
 * @description Unit tests for Photonic-Tachyon compute matrix scheduling and batch dispatching.
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePhotonicMatrixFitness,
  planTachyonBatchDispatch,
} from '../photonic-tachyon-scheduler-engine';
import type { PhotonicTachyonComputeMatrix } from '@/seed/types/photonic-tachyon-nexus';

describe('PhotonicTachyonSchedulerEngine', () => {
  const sampleMatrixHelios: PhotonicTachyonComputeMatrix = {
    matrixNodeId: 'matrix-helios-dyson',
    locationSector: 'DYSON_SWARM_HELIOS',
    peakQueccaflops: 5.5,
    opticalBackplaneLatencyNs: 7.8, // < 10.0 ns
    coherentQubitCount: 524_288,
    matrixAvailabilityScore: 0.999999999999,
    thermalCopRatio: 9.8,
    tachyonClockDriftFs: 95.0,
    status: 'ONLINE_SUPERCONDUCTING',
  };

  const sampleMatrixCentauri: PhotonicTachyonComputeMatrix = {
    matrixNodeId: 'matrix-alpha-centauri',
    locationSector: 'ALPHA_CENTAURI_SYNAPSE',
    peakQueccaflops: 4.8,
    opticalBackplaneLatencyNs: 9.2,
    coherentQubitCount: 300_000,
    matrixAvailabilityScore: 0.999999999999,
    thermalCopRatio: 9.2,
    tachyonClockDriftFs: 180.0,
    status: 'ONLINE_SUPERCONDUCTING',
  };

  const sampleMatrixPurge: PhotonicTachyonComputeMatrix = {
    ...sampleMatrixCentauri,
    matrixNodeId: 'matrix-offline-purge',
    status: 'MAINTENANCE_CRYOPURGE',
  };

  it('calculates multi-dimensional fitness score and rejects purged matrices', () => {
    const fitnessHelios = calculatePhotonicMatrixFitness(sampleMatrixHelios);
    const fitnessCentauri = calculatePhotonicMatrixFitness(sampleMatrixCentauri);
    const fitnessPurge = calculatePhotonicMatrixFitness(sampleMatrixPurge);

    expect(fitnessHelios).toBeGreaterThan(0);
    expect(fitnessCentauri).toBeGreaterThan(0);
    expect(fitnessHelios).toBeGreaterThan(fitnessCentauri);
    expect(fitnessPurge).toBe(0.0);
  });

  it('plans 4,000,000 workload dispatch to the optimal online matrix', () => {
    const dispatch = planTachyonBatchDispatch(
      [sampleMatrixHelios, sampleMatrixCentauri],
      4_000_000,
      120.0
    );

    expect(dispatch.targetMatrixId).toBe('matrix-helios-dyson');
    expect(dispatch.assignedWorkloads).toBe(4_000_000);
    expect(dispatch.totalOpticalPetabytes).toBe(8000);
    expect(dispatch.tachyonDriftFs).toBe(120.0);
    expect(dispatch.dispatchHash).toHaveLength(64);
  });

  it('throws error when no online matrices are available or drift exceeds 250 fs', () => {
    expect(() => planTachyonBatchDispatch([sampleMatrixPurge], 4_000_000, 50.0)).toThrow(
      'Zero online superconducting Photonic-Tachyon matrices available for dispatch'
    );

    expect(() =>
      planTachyonBatchDispatch([sampleMatrixHelios], 4_000_000, 260.0)
    ).toThrow(
      'Tachyon relativistic clock drift 260 fs exceeds allowable threshold 250 fs'
    );
  });
});
