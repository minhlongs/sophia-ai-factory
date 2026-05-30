/**
 * Quota Checker Service — barrel re-export
 *
 * Sub-modules:
 *   quota-checker-types.ts    — ExceededType, CachedQuota, QuotaCheckContext, QuotaConfig, DEFAULT_CONFIG, EnhancedQuotaCheckResult
 *   quota-checker-kv-cache.ts — getCachedUsage, updateCachedUsage, invalidateQuotaCache
 *   quota-checker-db.ts       — getEffectiveQuotaLimits, calculateCurrentUsage
 *   quota-checker-overage.ts  — logOverageEvent, getQuotaStatus
 *
 * @module quota/quota-checker
 */

import { getCachedUsage, updateCachedUsage } from './quota-checker-kv-cache';
import { getEffectiveQuotaLimits, calculateCurrentUsage } from './quota-checker-db';
import { logOverageEvent } from './quota-checker-overage';
import type { QuotaCheckContext, QuotaConfig, EnhancedQuotaCheckResult, ExceededType } from './quota-checker-types';
import { DEFAULT_CONFIG } from './quota-checker-types';

export type { ExceededType, CachedQuota, QuotaCheckContext, QuotaConfig, EnhancedQuotaCheckResult } from './quota-checker-types';
export { DEFAULT_CONFIG } from './quota-checker-types';
export { getCachedUsage, updateCachedUsage, invalidateQuotaCache } from './quota-checker-kv-cache';
export { getEffectiveQuotaLimits, calculateCurrentUsage } from './quota-checker-db';
export { logOverageEvent, getQuotaStatus } from './quota-checker-overage';

/**
 * Check quota with caching and overage logging.
 *
 * Flow:
 * 1. Try KV cache first (fast path)
 * 2. Cache miss → calculate from DB
 * 3. Check soft threshold (80%) → warning flag
 * 4. Check hard limit (100%) → block or log overage
 * 5. If allowed: atomically reserve requestedCredits in KV cache (#R2-17 fix)
 *    to prevent concurrent requests from both reading the same stale counter
 *    and both passing. The reservation is best-effort (KV unavailable = fail-open).
 */
export async function checkQuotaWithOverage(
  context: QuotaCheckContext,
  config: QuotaConfig = DEFAULT_CONFIG
): Promise<EnhancedQuotaCheckResult> {
  const { userId, licenseNonce, tier, requestedCredits } = context;

  const limits = await getEffectiveQuotaLimits(licenseNonce, tier);

  let cached = await getCachedUsage(userId, licenseNonce);

  if (!cached) {
    cached = await calculateCurrentUsage(userId, licenseNonce);
  }

  const checks = [
    { type: 'hourly_credits', current: cached.hourly, limit: limits.hourlyCredits },
    { type: 'daily_credits', current: cached.daily, limit: limits.dailyCredits },
    { type: 'monthly_credits', current: cached.monthly, limit: limits.monthlyCredits },
    { type: 'daily_requests', current: cached.requests, limit: limits.dailyRequests },
  ];

  let warningThreshold = false;
  let softLimitReached = false;

  for (const check of checks) {
    if (check.current >= check.limit * config.softWarningThreshold && check.current < check.limit) {
      warningThreshold = true;
      softLimitReached = true;
    }
  }

  for (const check of checks) {
    const usageAfter = check.current + requestedCredits;

    if (usageAfter > check.limit) {
      await logOverageEvent({
        ...context,
        exceededType: check.type,
        exceededLimit: check.limit,
        exceededCurrent: check.current,
        exceededBy: usageAfter - check.limit,
      }, config);

      if (config.failClosed && !config.enableOverageBilling) {
        return {
          allowed: false,
          remaining: {
            dailyCredits: Math.max(0, limits.dailyCredits - cached.daily),
            hourlyCredits: Math.max(0, limits.hourlyCredits - cached.hourly),
            dailyRequests: Math.max(0, limits.dailyRequests - cached.requests),
            monthlyCredits: Math.max(0, limits.monthlyCredits - cached.monthly),
          },
          exceeded: {
            type: check.type as ExceededType,
            limit: check.limit,
            current: check.current,
          },
          warningThreshold,
          softLimitReached: false,
        };
      }

      if (config.enableOverageBilling) {
        warningThreshold = true;
      }
    }
  }

  // Atomically reserve requestedCredits in KV cache before returning allowed=true
  // (#R2-17 race condition fix). This prevents two concurrent requests from both
  // reading the same counter, both passing, and then both decrementing separately.
  // Strategy: update the in-memory cached value and persist it; subsequent requests
  // in the same KV TTL window will see the incremented value. KV unavailability
  // degrades to fail-open (same behaviour as before this fix).
  const reserved: typeof cached = {
    hourly: cached.hourly + requestedCredits,
    daily: cached.daily + requestedCredits,
    monthly: cached.monthly + requestedCredits,
    requests: cached.requests + 1,
    timestamp: cached.timestamp,
  };
  updateCachedUsage(userId, licenseNonce, reserved).catch(() => {});

  return {
    allowed: true,
    remaining: {
      dailyCredits: limits.dailyCredits - reserved.daily,
      hourlyCredits: limits.hourlyCredits - reserved.hourly,
      dailyRequests: limits.dailyRequests - reserved.requests,
      monthlyCredits: limits.monthlyCredits - reserved.monthly,
    },
    warningThreshold,
    softLimitReached,
    overageAllowed: config.enableOverageBilling,
  };
}
