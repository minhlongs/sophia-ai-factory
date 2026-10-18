/**
 * Quota Soft/Hard Threshold Evaluator & Overage Dispatcher
 *
 * @module quota/quota-threshold-evaluator
 */

import { logOverageEvent } from './quota-checker-overage';
import type {
  CachedQuota,
  EnhancedQuotaCheckResult,
  ExceededType,
  QuotaCheckContext,
  QuotaConfig,
} from './quota-checker-types';

export interface QuotaEffectiveLimits {
  hourlyCredits: number;
  dailyCredits: number;
  monthlyCredits: number;
  dailyRequests: number;
}

export async function evaluateQuotaThresholds(params: {
  context: QuotaCheckContext;
  config: QuotaConfig;
  cached: CachedQuota;
  limits: QuotaEffectiveLimits;
}): Promise<{
  blockedResult?: EnhancedQuotaCheckResult;
  warningThreshold: boolean;
  softLimitReached: boolean;
}> {
  const { context, config, cached, limits } = params;
  const { requestedCredits } = context;

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
      await logOverageEvent(
        {
          ...context,
          exceededType: check.type,
          exceededLimit: check.limit,
          exceededCurrent: check.current,
          exceededBy: usageAfter - check.limit,
        },
        config,
      );

      if (config.failClosed && !config.enableOverageBilling) {
        return {
          warningThreshold,
          softLimitReached: false,
          blockedResult: {
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
          },
        };
      }

      if (config.enableOverageBilling) {
        warningThreshold = true;
      }
    }
  }

  return { warningThreshold, softLimitReached };
}
