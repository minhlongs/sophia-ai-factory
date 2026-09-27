import { describe, it, expect } from 'vitest';
import {
  calculateClusterFitnessScore,
  planPlanetaryWorkloadDispatch,
  evaluateEightNinesSla,
} from '../exaflop-matrix-engine';
import type { ExaflopComputeCluster } from '@/seed/types/exaflop-matrix';

describe('ExaFLOP Compute Matrix Engine Unit Tests', () => {
  const sampleClusters: ExaflopComputeCluster[] = [
    {
      id: 'cluster_iceland',
      clusterRef: 'ICELAND_GEOTHERMAL_01',
      architectureClass: 'BLACKWELL_B200_NVL72',
      totalFlopsExa: 1.8,
      activeGpusCount: 32768,
      thermalEfficiencyPercentage: 96.5,
      pueScore: 1.05,
      networkBackplaneTbps: 900.0,
      clusterStatus: 'OPTIMAL',
      datacenterLocation: 'ICELAND_GEOTHERMAL',
      updatedAt: '2026-09-27T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'cluster_norway',
      clusterRef: 'NORWAY_FJORDS_02',
      architectureClass: 'GRACE_HOPPER_GH200',
      totalFlopsExa: 1.2,
      activeGpusCount: 16384,
      thermalEfficiencyPercentage: 94.0,
      pueScore: 1.10,
      networkBackplaneTbps: 750.0,
      clusterStatus: 'OPTIMAL',
      datacenterLocation: 'NORWAY_FJORDS',
      updatedAt: '2026-09-27T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'cluster_throttled',
      clusterRef: 'TEXAS_SOLAR_03',
      architectureClass: 'AMD_MI300X_POD',
      totalFlopsExa: 0.8,
      activeGpusCount: 8192,
      thermalEfficiencyPercentage: 70.0,
      pueScore: 1.35,
      networkBackplaneTbps: 400.0,
      clusterStatus: 'THERMAL_THROTTLED',
      datacenterLocation: 'TEXAS_SOLAR',
      updatedAt: '2026-09-27T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    },
  ];

  it('calculates cluster fitness score prioritizing low PUE and high backplane', () => {
    const icelandFitness = calculateClusterFitnessScore(sampleClusters[0]);
    const norwayFitness = calculateClusterFitnessScore(sampleClusters[1]);
    const throttledFitness = calculateClusterFitnessScore(sampleClusters[2]);

    expect(icelandFitness).toBeGreaterThan(norwayFitness);
    expect(throttledFitness).toBe(0.0); // non-optimal returns 0
  });

  it('plans planetary dispatch allocating 250,000 workloads across healthy clusters', () => {
    const dispatchPlan = planPlanetaryWorkloadDispatch(250_000, sampleClusters);

    expect(dispatchPlan.totalWorkloads).toBe(250_000);
    expect(dispatchPlan.clusterAllocations.length).toBe(2); // Only Iceland and Norway
    const totalAllocated = dispatchPlan.clusterAllocations.reduce((sum, a) => sum + a.allocatedWorkloads, 0);
    expect(totalAllocated).toBe(250_000);
    expect(dispatchPlan.projectedDispatchLatencyMs).toBeLessThan(1.0); // sub-millisecond
  });

  it('evaluates Eight-Nines (99.999999%) SLA availability accurately', () => {
    // 1. Nominal case: 10 ms downtime in 30 days (Allowed is 25.92 ms) -> PASS
    const nominalSla = evaluateEightNinesSla('2026-09-GATE13', 10.0);
    expect(nominalSla.slaBreached).toBe(false);
    expect(nominalSla.availabilityPercentage).toBeGreaterThanOrEqual(99.999999);
    expect(nominalSla.byzantineQuorumSignatures).toBe(16);
    expect(nominalSla.auditMerkleRoot).toMatch(/^[a-f0-9]{64}$/);

    // 2. Breached case: 35 ms downtime in 30 days (> 25.92 ms) -> BREACH
    const breachedSla = evaluateEightNinesSla('2026-09-GATE13', 35.0);
    expect(breachedSla.slaBreached).toBe(true);
    expect(breachedSla.byzantineQuorumSignatures).toBe(0);
  });
});
