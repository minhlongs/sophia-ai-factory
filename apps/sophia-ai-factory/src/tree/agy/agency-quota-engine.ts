/**
 * Agency Quota & Rate Limit Mathematical Engine
 *
 * Provides pure deterministic calculations for sliding-window rate limiting,
 * monthly MCU quota evaluation, and burst capacity management.
 *
 * @module tree/agy/agency-quota-engine
 */

import type { RateLimitCheckResult } from '@/seed/types/agy-multitenancy';
import {
  checkMonthlyQuota,
  calculateNextQuotaState,
  evaluateAgencyBurstCapacity,
  type MonthlyQuotaEvaluationInput,
} from './agency-monthly-quota';

export {
  checkMonthlyQuota,
  calculateNextQuotaState,
  evaluateAgencyBurstCapacity,
  type MonthlyQuotaEvaluationInput,
};

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

  const activeTimestamps = input.timestamps.filter((ts) => ts > cutoff);
  const currentCount = activeTimestamps.length;

  const allowed = currentCount < maxRequests;
  const remaining = Math.max(0, maxRequests - currentCount - (allowed ? 1 : 0));

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
  nowMs: number = Date.now(),
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
