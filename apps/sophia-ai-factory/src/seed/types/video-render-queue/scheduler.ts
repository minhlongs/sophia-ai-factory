/**
 * Video Render Queue Scheduler Configuration & Metrics
 * Layer: seed/types/video-render-queue
 */

import type { CircuitBreakerState, GpuProvider, JobStatus, QueueLane } from './enums';
import type { VideoRenderJob } from './entities';

/**
 * Configuration options for the fair-share GPU scheduler
 */
export interface SchedulerConfig {
  /**
   * Fair-share ratio of priority jobs to standard jobs (e.g. 3 = 3 priority per 1 standard)
   */
  priorityToStandardRatio?: number;
  /**
   * Default lease duration in seconds (default: 60s)
   */
  defaultLeaseDurationSeconds?: number;
  /**
   * Max active concurrent jobs (leased + rendering) per tenant org
   */
  maxActiveRendersPerTenant?: Record<string, number> & {
    default: number;
    enterprise: number;
    master: number;
  };
}

/**
 * Default scheduler configuration
 */
export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  priorityToStandardRatio: 3,
  defaultLeaseDurationSeconds: 60,
  maxActiveRendersPerTenant: {
    default: 5,
    basic: 5,
    starter: 5,
    pro: 8,
    agency: 10,
    enterprise: 15,
    master: 15,
  },
};

/**
 * Result returned from a lease attempt
 */
export interface LeaseJobResult {
  leased: boolean;
  job?: VideoRenderJob;
  reason?: 'NO_JOBS' | 'TENANT_CONCURRENCY_LIMIT' | 'DATABASE_BUSY' | 'LOCK_CONTENTION';
}

/**
 * Summary metrics of the video render queue
 */
export interface QueueMetrics {
  priority: Record<JobStatus, number>;
  standard: Record<JobStatus, number>;
  totalActive: number;
  totalQueued: number;
  totalDlq: number;
  timestamp: number;
}

/**
 * Payload sent to dead-letter queue alert dispatchers
 */
export interface DlqAlertPayload {
  jobId: string;
  orgId: string;
  subaccountId?: string | null;
  tier: string;
  lane: QueueLane;
  provider?: GpuProvider | null;
  retryCount: number;
  maxRetries: number;
  errorMessage: string;
  dlqReason: string;
  failedAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * Health and circuit breaker status for an individual GPU provider
 */
export interface ProviderHealthStatus {
  provider: GpuProvider;
  healthy: boolean;
  circuitState: CircuitBreakerState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  cooldownUntil?: number;
  latencyMs?: number;
}
