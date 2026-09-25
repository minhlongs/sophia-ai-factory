/**
 * Global Multi-Region GPU Mesh & Dedicated Lane Configuration
 *
 * Layer: seed/config (Foundational constants — zero upper layer imports)
 *
 * @module seed/config/gpu-mesh
 */

import type { GpuMeshRegion, CircuitBreakerState } from '@/seed/types/gpu-mesh';

export interface RegionTopologyConfig {
  region: GpuMeshRegion;
  displayName: string;
  edgeNodes: readonly string[];
  allocatedProviders: readonly string[];
  defaultP95LatencyMs: number;
  defaultFallbackOrder: readonly GpuMeshRegion[];
}

export const GPU_MESH_REGIONS_CONFIG: Record<GpuMeshRegion, RegionTopologyConfig> = {
  apac: {
    region: 'apac',
    displayName: 'Asia Pacific (Singapore / Tokyo / Hanoi)',
    edgeNodes: ['sin', 'nrt', 'han'],
    allocatedProviders: ['fal', 'runpod', 'mekong'],
    defaultP95LatencyMs: 220,
    defaultFallbackOrder: ['us', 'eu'],
  },
  us: {
    region: 'us',
    displayName: 'United States (East / West)',
    edgeNodes: ['iad', 'sfo'],
    allocatedProviders: ['runpod', 'fal', 'replicate'],
    defaultP95LatencyMs: 180,
    defaultFallbackOrder: ['eu', 'apac'],
  },
  eu: {
    region: 'eu',
    displayName: 'Europe (Frankfurt / Amsterdam)',
    edgeNodes: ['fra', 'ams'],
    allocatedProviders: ['runpod', 'fal'],
    defaultP95LatencyMs: 210,
    defaultFallbackOrder: ['us', 'apac'],
  },
} as const;

export const GPU_MESH_SLA_CONFIG = {
  /**
   * Enterprise SLA Uptime Commitment: 99.9% availability
   */
  defaultUptimeTarget: 0.999,

  /**
   * P95 Execution Latency ceiling: 1500ms
   */
  defaultP95LatencyCeilingMs: 1500,

  /**
   * Rolling evaluation window for SLI calculation (15 minutes in seconds)
   */
  defaultEvaluationWindowSecs: 900,

  /**
   * Default service credit percentage per degradation incident
   */
  defaultRefundPct: 10.0,

  /**
   * Dedicated Enterprise Lane priority score (vs Master 200, Enterprise standard 100)
   */
  dedicatedLanePriorityScore: 300,

  /**
   * Default concurrent worker limit for dedicated enterprise lane
   */
  defaultConcurrencyLimit: 20,

  /**
   * Default reserved GPU units
   */
  defaultReservedUnits: 5,

  /**
   * Minimum monthly MCU commitment for enterprise contracts
   */
  minMonthlyMcu: 50000,

  /**
   * Default monthly MCU allocation
   */
  defaultMonthlyMcu: 100000,

  /**
   * Maximum standard monthly MCU commitment
   */
  maxMonthlyMcu: 500000,
} as const;

export const GPU_MESH_CIRCUIT_BREAKER_CONFIG = {
  /**
   * Failure rate percentage at or above which the circuit breaker trips OPEN
   */
  failureRateThresholdPct: 50.0,

  /**
   * Consecutive successful probes required to transition from HALF_OPEN to CLOSED
   */
  consecutiveSuccessesToClose: 3,

  /**
   * Cooldown period in seconds before testing an OPEN circuit in HALF_OPEN state
   */
  cooldownPeriodSecs: 300,

  /**
   * Default starting state
   */
  defaultState: 'CLOSED' as CircuitBreakerState,
} as const;
