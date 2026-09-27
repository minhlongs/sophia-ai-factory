/**
 * hectocorn-compute.ts — Gate 12 Milestone Seed Types
 * Pillar 3: Hectocorn Multi-Region GPU Compute Grid & High-Frequency Institutional Arbitrage Vault
 *
 * Target: 100,000 Concurrent Render Pipelines & Sub-Second Distributed Routing
 */

export const HECTOCORN_CONSTANTS = {
  TARGET_CONCURRENT_RENDERS: 100_000,
  TARGET_RENDER_MS_4K: 4_200, // 4.2 seconds average
  MAX_SLIPPAGE_TOLERANCE_BPS: 1, // 0.01%
  SEVEN_NINES_UPTIME: 99.99999, // 99.99999%
  MONTHLY_ALLOWED_DOWNTIME_MS: 259, // 259.2 ms
} as const;

export type ComputeProviderType =
  | 'BARE_METAL'
  | 'LAMBDA_LABS'
  | 'RUNPOD'
  | 'COREWEAVE'
  | 'ORACLE_CLOUD'
  | 'AWS_NEURON';

export type ComputeRegion =
  | 'US_EAST'
  | 'US_WEST'
  | 'EU_CENTRAL'
  | 'EU_WEST'
  | 'AP_SOUTHEAST'
  | 'AP_NORTHEAST'
  | 'SA_EAST';

export type GpuArchitecture =
  | 'NVIDIA_B200'
  | 'NVIDIA_H100_SXM'
  | 'NVIDIA_A100_80G'
  | 'AMD_MI300X'
  | 'APPLE_M3_ULTRA';

export type ComputeNodeStatus = 'READY' | 'BUSY' | 'DRAINING' | 'MAINTENANCE' | 'OFFLINE';

export interface HectocornComputeNode {
  id: string;
  clusterName: string;
  providerType: ComputeProviderType;
  region: ComputeRegion;
  gpuArchitecture: GpuArchitecture;
  gpuCount: number;
  totalVramGb: number;
  activeJobsCount: number;
  maxConcurrentJobs: number;
  nodeHealthScore: number;
  networkEgressGbps: number;
  status: ComputeNodeStatus;
  lastPingAt: string;
  createdAt: string;
}

export type RenderBatchStatus =
  | 'QUEUED'
  | 'DISPATCHING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PARTIALLY_FAILED';

export interface DistributedRenderBatch {
  id: string;
  batchId: string;
  totalRenders: number;
  completedRenders: number;
  failedRenders: number;
  allocatedNodesCount: number;
  averageRenderTimeMs: number;
  p99RenderTimeMs: number;
  status: RenderBatchStatus;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface HftArbitragePool {
  id: string;
  poolName: string;
  dexRouterAddress: string;
  cexClearingGateway: string;
  totalLiquidityCents: number;
  rebalancedVolume24hCents: number;
  arbitrageYieldCapturedCents: number;
  customerDividendDistributedCents: number;
  maxSlippageBps: number;
  isCircuitBreakerActive: boolean;
  lastArbitrageExecutionAt: string | null;
  createdAt: string;
}

export type SlaBreachStatus = 'HEALTHY' | 'WARNING' | 'BREACHED';

export interface SevenNinesSlaEvent {
  id: string;
  monthPeriod: string;
  totalSeconds: number;
  downtimeMilliseconds: number;
  uptimePercentage: number;
  breachStatus: SlaBreachStatus;
  penaltiesEscrowCents: number;
  lastEvaluatedAt: string;
}
