/**
 * Quota API Helpers
 *
 * Shared utilities for quota API endpoints
 * - formatQuotaResponse
 * - calculatePercentages
 * - getStatusLevel
 *
 * @module quota/quota-api-helpers
 */

import type { QuotaLimit } from '@/forest/usage-metering/types';

/**
 * Quota status levels
 */
export type QuotaStatusLevel = 'ok' | 'warning' | 'critical';

/**
 * Calculate usage percentages
 *
 * @param usage - Current usage values
 * @param limits - Quota limits
 * @returns Percentages for each dimension
 */
export function calculatePercentages(
  usage: { hourly: number; daily: number; monthly: number },
  limits: { hourlyCredits: number; dailyCredits: number; monthlyCredits: number }
): { hourly: number; daily: number; monthly: number } {
  return {
    hourly: limits.hourlyCredits > 0 ? (usage.hourly / limits.hourlyCredits) * 100 : 0,
    daily: limits.dailyCredits > 0 ? (usage.daily / limits.dailyCredits) * 100 : 0,
    monthly: limits.monthlyCredits > 0 ? (usage.monthly / limits.monthlyCredits) * 100 : 0,
  };
}

/**
 * Get status level based on max percentage
 *
 * @param percentages - Usage percentages
 * @returns Status level
 */
export function getStatusLevel(
  percentages: { hourly: number; daily: number; monthly: number }
): QuotaStatusLevel {
  const maxPercent = Math.max(percentages.hourly, percentages.daily, percentages.monthly);

  if (maxPercent >= 100) {
    return 'critical';
  }

  if (maxPercent >= 80) {
    return 'warning';
  }

  return 'ok';
}

/**
 * Format quota response for API
 *
 * @param usage - Current usage
 * @param limits - Quota limits
 * @param tier - User tier
 * @param polarSynced - Whether Polar sync is enabled
 * @param lastPolarSync - Last Polar sync timestamp
 * @returns Formatted quota response
 */
export function formatQuotaResponse(
  usage: { hourly: number; daily: number; monthly: number; requests: number },
  limits: QuotaLimit,
  tier: string,
  polarSynced: boolean = false,
  lastPolarSync?: string
) {
  const percentages = calculatePercentages(
    { hourly: usage.hourly, daily: usage.daily, monthly: usage.monthly },
    {
      hourlyCredits: limits.hourlyCredits,
      dailyCredits: limits.dailyCredits,
      monthlyCredits: limits.monthlyCredits,
    }
  );

  const status = getStatusLevel(percentages);

  return {
    usage,
    limits: {
      hourlyCredits: limits.hourlyCredits,
      dailyCredits: limits.dailyCredits,
      monthlyCredits: limits.monthlyCredits,
      dailyRequests: limits.dailyRequests,
    },
    percentages,
    status,
    polarSynced,
    lastPolarSync,
  };
}

/**
 * Calculate remaining quota
 *
 * @param usage - Current usage
 * @param limits - Quota limits
 * @returns Remaining quota for each dimension
 */
export function calculateRemaining(
  usage: { hourly: number; daily: number; monthly: number; requests: number },
  limits: { hourlyCredits: number; dailyCredits: number; monthlyCredits: number; dailyRequests: number }
): { hourly: number; daily: number; monthly: number; requests: number } {
  return {
    hourly: Math.max(0, limits.hourlyCredits - usage.hourly),
    daily: Math.max(0, limits.dailyCredits - usage.daily),
    monthly: Math.max(0, limits.monthlyCredits - usage.monthly),
    requests: Math.max(0, limits.dailyRequests - usage.requests),
  };
}
