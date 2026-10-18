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

import { getCachedUsage, atomicIncrementQuota } from './quota-checker-kv-cache';
import { getEffectiveQuotaLimits, calculateCurrentUsage } from './quota-checker-db';
import { logOverageEvent, getQuotaStatus } from './quota-checker-overage';
import type { QuotaCheckContext, QuotaConfig, EnhancedQuotaCheckResult } from './quota-checker-types';
import { DEFAULT_CONFIG } from './quota-checker-types';
import { evaluateQuotaThresholds } from './quota-threshold-evaluator';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export type { ExceededType, CachedQuota, QuotaCheckContext, QuotaConfig, EnhancedQuotaCheckResult } from './quota-checker-types';
export { DEFAULT_CONFIG } from './quota-checker-types';
export { getCachedUsage, updateCachedUsage, invalidateQuotaCache, atomicIncrementQuota } from './quota-checker-kv-cache';
export { getEffectiveQuotaLimits, calculateCurrentUsage } from './quota-checker-db';
export { logOverageEvent, getQuotaStatus };

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

  const evaluation = await evaluateQuotaThresholds({
    context,
    config,
    cached,
    limits,
  });

  if (evaluation.blockedResult) {
    return evaluation.blockedResult;
  }

  const { warningThreshold, softLimitReached } = evaluation;

  // Atomically reserve requestedCredits in KV cache before returning allowed=true
  // (#R2-17 race condition fix).
  const reserved: typeof cached = {
    hourly: cached.hourly + requestedCredits,
    daily: cached.daily + requestedCredits,
    monthly: cached.monthly + requestedCredits,
    requests: cached.requests + 1,
    timestamp: cached.timestamp,
  };
  atomicIncrementQuota(userId, licenseNonce, reserved.timestamp ?? Date.now(), requestedCredits).catch((err) => {
    logger.warn('[Quota Checker] Atomic KV increment failed', toError(err));
  });

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
