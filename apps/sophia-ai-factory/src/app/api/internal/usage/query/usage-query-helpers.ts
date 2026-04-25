import { NextRequest } from 'next/server';
import { QUOTA_LIMITS } from '@/lib/usage-metering/aggregator';
import { logger } from '@/lib/utils/logger-utility';
import type { HourlySummary, DailySummary } from '@/lib/usage-metering/types';

/** Validate X-Internal-Secret header against INTERNAL_WEBHOOK_SECRET env var. */
export function validateInternalSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-internal-secret');
  const expectedSecret = process.env.INTERNAL_WEBHOOK_SECRET;

  if (!expectedSecret) {
    logger.warn('[Internal Usage Query] INTERNAL_WEBHOOK_SECRET not configured');
    return false;
  }

  if (!secret || secret !== expectedSecret) {
    logger.warn('[Internal Usage Query] Invalid or missing internal secret');
    return false;
  }

  return true;
}

/** Calculate totals from hourly summaries (requests, credits, tokens, errors, avg RT). */
export function calculateTotalsFromHourly(hourly: HourlySummary[]): {
  totalRequests: number;
  totalCredits: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalErrors: number;
  avgResponseTimeMs: number;
} {
  let totalRequests = 0;
  let totalCredits = 0;
  let totalTokensInput = 0;
  let totalTokensOutput = 0;
  let totalErrors = 0;
  let weightedRtSum = 0;

  for (const hour of hourly) {
    totalRequests += hour.totalRequests;
    totalCredits += hour.totalCredits;
    totalTokensInput += hour.totalTokens;

    for (const service of hour.serviceBreakdown) {
      totalTokensOutput += service.tokensOutput;
      totalErrors += service.errorCount;
      weightedRtSum += service.avgResponseTimeMs * service.requestCount;
    }
  }

  return {
    totalRequests,
    totalCredits,
    totalTokensInput,
    totalTokensOutput: totalTokensOutput - totalTokensInput,
    totalErrors,
    avgResponseTimeMs: totalRequests > 0
      ? Math.round((weightedRtSum / totalRequests) * 100) / 100
      : 0,
  };
}

/** Build per-service aggregation from hourly summaries. */
export function buildServiceBreakdown(
  hourly: HourlySummary[]
): Record<string, { requests: number; credits: number; tokensInput: number; tokensOutput: number }> {
  const serviceMap = new Map<string, { requests: number; credits: number; tokensInput: number; tokensOutput: number }>();

  for (const hour of hourly) {
    for (const service of hour.serviceBreakdown) {
      const serviceName = service.featureKey.split('.')[0];
      const existing = serviceMap.get(serviceName) || { requests: 0, credits: 0, tokensInput: 0, tokensOutput: 0 };
      existing.requests += service.requestCount;
      existing.credits += service.consumedUnits;
      existing.tokensInput += service.tokensInput;
      existing.tokensOutput += service.tokensOutput;
      serviceMap.set(serviceName, existing);
    }
  }

  return Object.fromEntries(serviceMap);
}

/** Build per-feature aggregation from hourly summaries. */
export function buildFeatureBreakdown(
  hourly: HourlySummary[]
): Record<string, { requests: number; credits: number }> {
  const featureMap = new Map<string, { requests: number; credits: number }>();

  for (const hour of hourly) {
    for (const service of hour.serviceBreakdown) {
      const existing = featureMap.get(service.featureKey) || { requests: 0, credits: 0 };
      existing.requests += service.requestCount;
      existing.credits += service.consumedUnits;
      featureMap.set(service.featureKey, existing);
    }
  }

  return Object.fromEntries(featureMap);
}

/** Calculate current hourly/daily/monthly quota usage against tier limits. */
export function calculateQuotaUsage(
  hourly: HourlySummary[],
  daily: DailySummary[],
  tier: string
): {
  hourlyUsed: number;
  hourlyLimit: number;
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
} {
  const quota = QUOTA_LIMITS[tier] || QUOTA_LIMITS.BASIC;
  const now = Date.now();
  const currentHourStart = Math.floor(now / 3600000) * 3600000;
  const currentDayStart = Math.floor(now / 86400000) * 86400000;

  const currentHourMs = hourly.find(h => h.hourTimestamp === currentHourStart / 1000);
  const currentDay = daily.find(d => d.dayTimestamp === currentDayStart / 1000);

  return {
    hourlyUsed: currentHourMs?.totalCredits || 0,
    hourlyLimit: quota.hourlyCredits,
    dailyUsed: currentDay?.totalCredits || 0,
    dailyLimit: quota.dailyCredits,
    monthlyUsed: hourly.reduce((sum, h) => sum + h.totalCredits, 0),
    monthlyLimit: quota.monthlyCredits,
  };
}
