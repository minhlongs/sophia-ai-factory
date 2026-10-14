/**
 * Video Render Queue Enums, Constants & Guards
 * Layer: seed/types/video-render-queue
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
