/**
 * Agency Quota & Rate Limit Mathematical Engine
 *
 * Provides pure deterministic calculations for sliding-window rate limiting,
 * monthly MCU quota evaluation, and burst capacity management.
 *
 * Invariants:
 * - Pure logic: 0 side effects, 0 DB queries, 0 mutable state.
 * - Layer: tree (imports only @/seed/*).
 *
 * @module tree/agy/agency-quota-engine
 */

import type {
  QuotaEvaluationResult,
  RateLimitCheckResult,
} from '@/seed/types/agy-multitenancy';

export interface RateLimitWindowInput {
  /** Array of millisecond timestamps of previous requests */
  timestamps: number[];
  /** Current evaluation timestamp in milliseconds (defaults to Date.now()) */
  nowMs?: number;
  /** Sliding window duration in milliseconds (default: 1000ms for RPS, or 60000ms for RPM) */
  windowMs?: number;
  /** Maximum allowed requests within the window */
  maxRequests: number;
}

export interface SlidingWindowResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  remaining: number;
  resetMs: number;
  retryAfterSeconds: number;
  prunedTimestamps: number[];
}

/**
 * Pure sliding-window calculation for rate limiting.
 * Drops expired timestamps and determines if a new request is permitted.
 */
export function checkRateLimitWindow(input: RateLimitWindowInput): SlidingWindowResult {
  const nowMs = input.nowMs ?? Date.now();
  const windowMs = input.windowMs ?? 1000;
  const maxRequests = Math.max(1, input.maxRequests);
  const cutoff = nowMs - windowMs;

  // Filter timestamps within current sliding window
  const activeTimestamps = input.timestamps.filter((ts) => ts > cutoff);
  const currentCount = activeTimestamps.length;

  const allowed = currentCount < maxRequests;
  const remaining = Math.max(0, maxRequests - currentCount - (allowed ? 1 : 0));

  // Oldest timestamp in window determines when first slot resets
  const oldestTimestamp = activeTimestamps[0] ?? nowMs;
  const resetMs = Math.max(0, oldestTimestamp + windowMs - nowMs);
  const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil(resetMs / 1000));

  const prunedTimestamps = allowed ? [...activeTimestamps, nowMs] : activeTimestamps;

  return {
    allowed,
    currentCount,
    limit: maxRequests,
    remaining,
    resetMs,
    retryAfterSeconds,
    prunedTimestamps,
  };
}

/**
 * Pure rate-limit evaluation given requests per second (RPS) configuration.
 */
export function checkRateLimitRps(
  agencyId: string,
  requestCountInSecond: number,
  limitRps: number,
  nowMs: number = Date.now()
): RateLimitCheckResult {
  const currentRps = Math.max(0, requestCountInSecond);
  const safeLimit = Math.max(1, limitRps);
  const allowed = currentRps < safeLimit;
  const remaining = Math.max(0, safeLimit - currentRps - (allowed ? 1 : 0));
  const resetMs = 1000 - (nowMs % 1000);
  const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil(resetMs / 1000));

  return {
    allowed,
    agencyId,
    currentRps,
    limitRps: safeLimit,
    remaining,
    resetMs,
    retryAfterSeconds,
  };
}

export interface MonthlyQuotaEvaluationInput {
  agencyId: string;
  quotaLimitMcu: number;
  quotaUsedMcu: number;
  requestedMcu?: number;
  allowOverage?: boolean;
}

/**
 * Pure evaluation of monthly MCU quota deficit or surplus.
 */
export function checkMonthlyQuota(input: MonthlyQuotaEvaluationInput): QuotaEvaluationResult {
  const { agencyId, quotaLimitMcu, quotaUsedMcu, allowOverage = false } = input;
  const requestedMcu = Math.max(0, input.requestedMcu ?? 0);

  const safeLimit = Math.max(0, quotaLimitMcu);
  const safeUsed = Math.max(0, quotaUsedMcu);
  const projectedUsed = safeUsed + requestedMcu;

  const remainingMcu = Math.max(0, safeLimit - safeUsed);
  const deficitMcu = Math.max(0, projectedUsed - safeLimit);

  if (projectedUsed <= safeLimit) {
    const isWarning = remainingMcu <= safeLimit * 0.1 && safeLimit > 0;
    return {
      allowed: true,
      agencyId,
      quotaLimitMcu: safeLimit,
      quotaUsedMcu: safeUsed,
      remainingMcu,
      deficitMcu: 0,
      status: isWarning ? 'warning' : 'ok',
    };
  }

  // Over limit
  if (allowOverage) {
    return {
      allowed: true,
      agencyId,
      quotaLimitMcu: safeLimit,
      quotaUsedMcu: safeUsed,
      remainingMcu: 0,
      deficitMcu,
      status: 'warning',
      reason: `Overage allowed: deficit of ${deficitMcu} MCU incurred`,
    };
  }

  return {
    allowed: false,
    agencyId,
    quotaLimitMcu: safeLimit,
    quotaUsedMcu: safeUsed,
    remainingMcu: 0,
    deficitMcu,
    status: 'exhausted',
    reason: `Agency monthly quota exceeded. Limit: ${safeLimit} MCU, Used: ${safeUsed} MCU, Requested: ${requestedMcu} MCU`,
  };
}

/**
 * Calculates updated quota usage after an increment or decrement.
 */
export function calculateNextQuotaState(currentUsedMcu: number, deltaMcu: number): number {
  return Math.max(0, Math.round(currentUsedMcu + deltaMcu));
}

/**
 * Evaluates burst allowance for short spikes (e.g. 1.5x standard RPS for up to 5 seconds).
 */
export function evaluateAgencyBurstCapacity(params: {
  currentRps: number;
  rateLimitRps: number;
  burstMultiplier?: number;
}): { allowed: boolean; burstLimit: number; currentRps: number } {
  const multiplier = params.burstMultiplier ?? 1.5;
  const burstLimit = Math.ceil(params.rateLimitRps * multiplier);
  const allowed = params.currentRps <= burstLimit;

  return {
    allowed,
    burstLimit,
    currentRps: params.currentRps,
  };
}
