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
 * 5. Update cache (non-blocking)
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
    updateCachedUsage(userId, licenseNonce, cached).catch(() => {});
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

  return {
    allowed: true,
    remaining: {
      dailyCredits: limits.dailyCredits - cached.daily,
      hourlyCredits: limits.hourlyCredits - cached.hourly,
      dailyRequests: limits.dailyRequests - cached.requests,
      monthlyCredits: limits.monthlyCredits - cached.monthly,
    },
    warningThreshold,
    softLimitReached,
    overageAllowed: config.enableOverageBilling,
  };
}
