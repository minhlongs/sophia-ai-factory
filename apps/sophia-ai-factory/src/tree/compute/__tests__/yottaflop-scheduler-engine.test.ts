import { describe, it, expect } from 'vitest';
import {
  calculateGridSchedulingScore,
  planQuantumBatchDispatch,
} from '../yottaflop-scheduler-engine';
import type { YottaflopComputeGrid } from '@/seed/types/yottaflop-matrix';

describe('YottaFLOP Planetary Quantum Scheduler Engine Unit Tests', () => {
  const mockGrids: YottaflopComputeGrid[] = [
    {
      id: 'grid_antarctic',
      gridIdentifier: 'GRID_ANTARCTIC_SUBGLACIAL_01',
      supercomputingTier: 'YOTTA_HYBRID_QUANTUM',
      activeQubitsLogical: 8192,
      activeGpusCount: 131072,
      peakYottaflops: 1.8,
      interconnectLatencyNanoseconds: 250, // 250 ns
      powerDrawMegawatts: 750.0,
      gridHealthScore: 0.99,
      status: 'ONLINE_OPTIMAL',
      datacenterBiome: 'ANTARCTIC_SUBGLACIAL',
      updatedAt: '2026-09-27T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'grid_lunar',
      gridIdentifier: 'GRID_LUNAR_CRATER_02',
      supercomputingTier: 'PHOTONIC_SUPERLATTICE',
      activeQubitsLogical: 4096,
      activeGpusCount: 65536,
      peakYottaflops: 1.2,
      interconnectLatencyNanoseconds: 400,
      powerDrawMegawatts: 450.0,
      gridHealthScore: 0.98,
      status: 'ONLINE_OPTIMAL',
      datacenterBiome: 'LUNAR_CRATER_SHADOW',
      updatedAt: '2026-09-27T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'grid_curtailed',
      gridIdentifier: 'GRID_SAHARA_CURTAILED',
      supercomputingTier: 'ORBITAL_SOLAR_ARRAY',
      activeQubitsLogical: 2048,
      activeGpusCount: 32768,
      peakYottaflops: 0.8,
      interconnectLatencyNanoseconds: 800,
      powerDrawMegawatts: 900.0,
      gridHealthScore: 0.70,
      status: 'ENERGY_CURTAILED',
      datacenterBiome: 'SAHARA_SOLAR_BASIN',
      updatedAt: '2026-09-27T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    },
  ];

  it('calculates grid composite score prioritizing low latency, high peak YottaFLOPs and qubits', () => {
    const antarcticScore = calculateGridSchedulingScore(mockGrids[0]);
    const lunarScore = calculateGridSchedulingScore(mockGrids[1]);
    const curtailedScore = calculateGridSchedulingScore(mockGrids[2]);

    expect(antarcticScore.isEligible).toBe(true);
    expect(antarcticScore.compositeScore).toBeGreaterThan(lunarScore.compositeScore);
    expect(curtailedScore.isEligible).toBe(false); // curtailed / low health is ineligible
    expect(curtailedScore.compositeScore).toBe(0.0);
  });

  it('plans planetary quantum dispatch of 500,000 workloads across eligible grids', () => {
    const plan = planQuantumBatchDispatch(500_000, mockGrids);

    expect(plan.totalWorkloads).toBe(500_000);
    expect(plan.scheduledGridsCount).toBe(2); // Only Antarctic and Lunar
    const totalAllocated = plan.allocations.reduce((sum, a) => sum + a.allocatedJobs, 0);
    expect(totalAllocated).toBe(500_000);
    expect(plan.projectedDispatchLatencyMicroseconds).toBeLessThan(500); // sub-microsecond
  });
});
