import { describe, it, expect } from 'vitest';
import {
  calculateNodeFitness,
  planRenderBatchDispatch,
  evaluateSevenNinesSla,
} from '../hectocorn-compute-grid';
import type { HectocornComputeNode } from '@/seed/types/hectocorn-compute';

describe('Hectocorn Compute Grid Unit Tests', () => {
  const sampleNodes: HectocornComputeNode[] = [
    {
      id: 'node_b200_us',
      clusterName: 'US-EAST-B200-01',
      providerType: 'BARE_METAL',
      region: 'US_EAST',
      gpuArchitecture: 'NVIDIA_B200',
      gpuCount: 8,
      totalVramGb: 1536,
      activeJobsCount: 10,
      maxConcurrentJobs: 64,
      nodeHealthScore: 1.0,
      networkEgressGbps: 100.0,
      status: 'READY',
      lastPingAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'node_h100_eu',
      clusterName: 'EU-CENTRAL-H100-01',
      providerType: 'COREWEAVE',
      region: 'EU_CENTRAL',
      gpuArchitecture: 'NVIDIA_H100_SXM',
      gpuCount: 8,
      totalVramGb: 640,
      activeJobsCount: 20,
      maxConcurrentJobs: 64,
      nodeHealthScore: 0.95,
      networkEgressGbps: 80.0,
      status: 'READY',
      lastPingAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ];

  it('calculates node fitness based on health, capacity, egress, and vram', () => {
    const fitness1 = calculateNodeFitness(sampleNodes[0]);
    expect(fitness1.fitnessScore).toBeGreaterThan(0.7);
    expect(fitness1.availableCapacity).toBe(54);

    const offlineNode: HectocornComputeNode = {
      ...sampleNodes[0],
      status: 'OFFLINE',
    };
    const fitnessOffline = calculateNodeFitness(offlineNode);
    expect(fitnessOffline.fitnessScore).toBe(0);
    expect(fitnessOffline.availableCapacity).toBe(0);
  });

  it('plans render batch dispatch across available compute nodes', () => {
    const plan = planRenderBatchDispatch('BATCH_100K_TEST', 1000, sampleNodes);

    expect(plan.batchId).toBe('BATCH_100K_TEST');
    expect(plan.totalRenders).toBe(1000);
    expect(plan.allocations.length).toBe(2);

    const allocatedTotal = plan.allocations.reduce((sum, a) => sum + a.assignedRenders, 0);
    expect(allocatedTotal).toBe(1000);
    expect(plan.estimatedDurationMs).toBeGreaterThan(0);
  });

  it('evaluates Seven-Nines SLA and applies penalty when downtime exceeds 259ms', () => {
    const healthyPeriod = evaluateSevenNinesSla('2026-09', 150);
    expect(healthyPeriod.breachStatus).toBe('HEALTHY');
    expect(healthyPeriod.uptimePercentage).toBeGreaterThan(99.9999);
    expect(healthyPeriod.penaltiesEscrowCents).toBe(0);

    const breachedPeriod = evaluateSevenNinesSla('2026-09', 459); // 200ms breach
    expect(breachedPeriod.breachStatus).toBe('BREACHED');
    expect(breachedPeriod.penaltiesEscrowCents).toBe(2_000_000); // $20,000 penalty
  });
});
