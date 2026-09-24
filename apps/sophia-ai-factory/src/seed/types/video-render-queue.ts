/**
 * Distributed Batch Queue & Fair-Share GPU Mesh Scheduler Types
 *
 * Layer: seed/types (Foundational — zero external runtime dependencies, 0 upper layer imports)
 *
 * @module seed/types/video-render-queue
 */

export type QueueLane = 'priority' | 'standard';

export const ALL_QUEUE_LANES: readonly QueueLane[] = ['priority', 'standard'] as const;

export function isQueueLane(value: unknown): value is QueueLane {
  return typeof value === 'string' && ALL_QUEUE_LANES.includes(value as QueueLane);
}

export type JobStatus = 'queued' | 'leased' | 'rendering' | 'completed' | 'failed' | 'dlq';

export const ALL_JOB_STATUSES: readonly JobStatus[] = [
  'queued',
  'leased',
  'rendering',
  'completed',
  'failed',
  'dlq',
] as const;

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && ALL_JOB_STATUSES.includes(value as JobStatus);
}

export type GpuProvider = 'fal' | 'runpod' | 'replicate' | 'mekong';

export const ALL_GPU_PROVIDERS: readonly GpuProvider[] = [
  'fal',
  'runpod',
  'replicate',
  'mekong',
] as const;

export function isGpuProvider(value: unknown): value is GpuProvider {
  return typeof value === 'string' && ALL_GPU_PROVIDERS.includes(value as GpuProvider);
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export const ALL_CIRCUIT_BREAKER_STATES: readonly CircuitBreakerState[] = [
  'CLOSED',
  'OPEN',
  'HALF_OPEN',
] as const;

export function isCircuitBreakerState(value: unknown): value is CircuitBreakerState {
  return typeof value === 'string' && ALL_CIRCUIT_BREAKER_STATES.includes(value as CircuitBreakerState);
}

/**
 * Priority scores mapped by tier name (both uppercase and lowercase).
 * Master: 200, Enterprise: 100, Agency: 50, Pro: 25, Starter/Basic: 10.
 */
export const PRIORITY_SCORES: Record<string, number> = {
  MASTER: 200,
  master: 200,
  ENTERPRISE: 100,
  enterprise: 100,
  AGENCY: 50,
  agency: 50,
  PRO: 25,
  pro: 25,
  PREMIUM: 25,
  premium: 25,
  STARTER: 10,
  starter: 10,
  BASIC: 10,
  basic: 10,
  FREE: 5,
  free: 5,
};

/**
 * Resolves priority score for a given tier string.
 */
export function getPriorityScoreForTier(tier: string | null | undefined): number {
  if (!tier) return 10;
  return PRIORITY_SCORES[tier] ?? PRIORITY_SCORES[tier.toUpperCase()] ?? 10;
}

/**
 * Resolves default queue lane for a given tier or score.
 * Enterprise (100) and Master (200) get the priority lane.
 */
export function getLaneForTier(tier: string | null | undefined): QueueLane {
  const score = getPriorityScoreForTier(tier);
  return score >= 100 ? 'priority' : 'standard';
}

/**
 * Raw SQLite/D1 database row representation
 */
export interface VideoRenderRow {
  id: string;
  org_id: string;
  subaccount_id: string | null;
  lane: QueueLane;
  priority_score: number;
  status: JobStatus;
  tier: string;
  payload: string;
  result_url: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  leased_by: string | null;
  leased_until: number | null;
  provider: GpuProvider | null;
  dlq_reason: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Parsed domain entity representation
 */
export interface VideoRenderJob {
  id: string;
  orgId: string;
  subaccountId?: string | null;
  lane: QueueLane;
  priorityScore: number;
  status: JobStatus;
  tier: string;
  payload: Record<string, unknown> | string;
  resultUrl?: string | null;
  errorMessage?: string | null;
  retryCount: number;
  maxRetries: number;
  leasedBy?: string | null;
  leasedUntil?: number | null;
  provider?: GpuProvider | null;
  dlqReason?: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Input parameters for enqueuing a new render job
 */
export interface EnqueueJobInput {
  id?: string;
  orgId: string;
  subaccountId?: string | null;
  tier: string;
  payload: Record<string, unknown> | string;
  lane?: QueueLane;
  priorityScore?: number;
  maxRetries?: number;
  preferredProvider?: GpuProvider;
}

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

/**
 * Safely parses raw string payload into Record or returns raw string
 */
export function parseJobPayload(raw: string): Record<string, unknown> | string {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return raw;
  } catch {
    return raw;
  }
}

/**
 * Maps a database row to a typed VideoRenderJob entity
 */
export function mapRowToJob(row: VideoRenderRow): VideoRenderJob {
  return {
    id: row.id,
    orgId: row.org_id,
    subaccountId: row.subaccount_id,
    lane: row.lane,
    priorityScore: row.priority_score,
    status: row.status,
    tier: row.tier,
    payload: parseJobPayload(row.payload),
    resultUrl: row.result_url,
    errorMessage: row.error_message,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    leasedBy: row.leased_by,
    leasedUntil: row.leased_until,
    provider: row.provider,
    dlqReason: row.dlq_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
