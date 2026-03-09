/**
 * Usage Aggregator Service for Billing Dashboard
 *
 * Provides usage summaries and overage calculations for the AgencyOS Dashboard UI.
 * Aggregates usage_events from database and calculates:
 * - Current period usage vs quota limits
 * - Overage units exceeded
 * - Predictive forecasts based on usage trends
 *
 * @module billing/usage-aggregator
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import type { Tier } from '@/types';
import { QUOTA_LIMITS } from '@/lib/usage-metering/aggregator';

/**
 * Usage summary for a license
 */
export interface UsageSummary {
  /** User ID */
  userId: string;
  /** License nonce */
  licenseNonce: string;
  /** User's current tier */
  tier: Tier;
  /** Billing period start timestamp */
  periodStart: number;
  /** Billing period end timestamp */
  periodEnd: number;
  /** Hourly credits used */
  hourlyCredits: number;
  /** Hourly credit limit */
  hourlyLimit: number;
  /** Hourly overage (if exceeded) */
  hourlyOverage: number;
  /** Daily credits used */
  dailyCredits: number;
  /** Daily credit limit */
  dailyLimit: number;
  /** Daily overage (if exceeded) */
  dailyOverage: number;
  /** Monthly credits used */
  monthlyCredits: number;
  /** Monthly credit limit */
  monthlyLimit: number;
  /** Monthly overage (if exceeded) */
  monthlyOverage: number;
  /** Daily requests count */
  dailyRequests: number;
  /** Daily request limit */
  dailyRequestLimit: number;
  /** Daily request overage (if exceeded) */
  dailyRequestOverage: number;
  /** Percentage of hourly limit used (0-100) */
  hourlyPercentage: number;
  /** Percentage of daily limit used (0-100) */
  dailyPercentage: number;
  /** Percentage of monthly limit used (0-100) */
  monthlyPercentage: number;
  /** Usage status */
  status: 'ok' | 'warning' | 'critical' | 'overage';
  /** Polar customer ID if linked */
  polarCustomerId?: string;
  /** Last synced from Polar timestamp */
  lastPolarSync?: string;
}

/**
 * Overage event detected
 */
export interface OverageDetected {
  /** Type of overage */
  type: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
  /** Limit that was exceeded */
  limit: number;
  /** Actual usage */
  current: number;
  /** Amount exceeded by */
  exceededBy: number;
  /** Overage fee (if applicable) */
  overageFee?: number;
}

/**
 * Usage forecast prediction
 */
export interface UsageForecast {
  /** Predicted end-of-period usage */
  predictedUsage: number;
  /** Whether overage is predicted */
  willExceedLimit: boolean;
  /** Predicted overage amount */
  predictedOverage?: number;
  /** Days remaining in period */
  daysRemaining: number;
  /** Daily average usage rate */
  dailyAverage: number;
  /** Recommended action */
  recommendation: string;
}

/**
 * Get current billing period timestamps
 */
function getCurrentBillingPeriod(): { periodStart: number; periodEnd: number } {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime() / 1000;
  return { periodStart, periodEnd };
}

/**
 * Aggregate usage for a license
 *
 * @param licenseNonce - License identifier
 * @param periodStart - Optional custom period start (defaults to current month)
 * @param periodEnd - Optional custom period end (defaults to current month end)
 */
export async function aggregateUsageForLicense(
  licenseNonce: string,
  periodStart?: number,
  periodEnd?: number
): Promise<UsageSummary | null> {
  const supabase = createAdminClient();

  try {
    // Get license info
    const { data: license, error: licenseError } = await supabase
      .from('raas_licenses')
      .select('nonce, tier, created_by, polar_customer_id')
      .eq('nonce', licenseNonce)
      .single() as any;

    if (licenseError || !license) {
      logger.debug('[Usage Aggregator] License not found', { licenseNonce: licenseNonce.slice(0, 8) });
      return null;
    }

    const userId = license.created_by as string;
    const tier = ((license.tier as string) || 'BASIC').toUpperCase() as Tier;
    const polarCustomerId = license.polar_customer_id as string | null;

    // Get period timestamps
    const { periodStart: defaultStart, periodEnd: defaultEnd } = getCurrentBillingPeriod();
    const startTs = periodStart || defaultStart;
    const endTs = periodEnd || defaultEnd;

    // Get quota limits for tier
    const limits = QUOTA_LIMITS[tier] || QUOTA_LIMITS.BASIC;

    // Calculate time boundaries
    const now = Math.floor(Date.now() / 1000);
    const hourStart = Math.floor(now / 3600) * 3600;
    const dayStart = Math.floor(now / 86400) * 86400;

    // Fetch usage data in parallel
    const [hourlyResult, dailyResult, monthlyResult] = await Promise.all([
      supabase
        .from('usage_events')
        .select('credits_used')
        .eq('user_id', userId)
        .eq('license_nonce', licenseNonce)
        .gte('created_at', hourStart)
        .lt('created_at', hourStart + 3600),
      supabase
        .from('usage_events')
        .select('credits_used')
        .eq('user_id', userId)
        .eq('license_nonce', licenseNonce)
        .gte('created_at', dayStart)
        .lt('created_at', dayStart + 86400),
      supabase
        .from('usage_events')
        .select('credits_used')
        .eq('user_id', userId)
        .eq('license_nonce', licenseNonce)
        .gte('created_at', startTs)
        .lte('created_at', endTs),
    ]);

    // Aggregate usage
    const hourlyCredits = (hourlyResult.data as any[])?.reduce((sum, r) => sum + (r.credits_used || 0), 0) || 0;
    const dailyCredits = (dailyResult.data as any[])?.reduce((sum, r) => sum + (r.credits_used || 0), 0) || 0;
    const monthlyCredits = (monthlyResult.data as any[])?.reduce((sum, r) => sum + (r.credits_used || 0), 0) || 0;
    const dailyRequests = dailyResult.data?.length || 0;

    // Calculate overages
    const hourlyOverage = Math.max(0, hourlyCredits - limits.hourlyCredits);
    const dailyOverage = Math.max(0, dailyCredits - limits.dailyCredits);
    const monthlyOverage = Math.max(0, monthlyCredits - limits.monthlyCredits);
    const dailyRequestOverage = Math.max(0, dailyRequests - limits.dailyRequests);

    // Calculate percentages
    const hourlyPercentage = (hourlyCredits / limits.hourlyCredits) * 100;
    const dailyPercentage = (dailyCredits / limits.dailyCredits) * 100;
    const monthlyPercentage = (monthlyCredits / limits.monthlyCredits) * 100;

    // Determine status
    const maxPercent = Math.max(hourlyPercentage, dailyPercentage, monthlyPercentage);
    let status: 'ok' | 'warning' | 'critical' | 'overage' = 'ok';

    if (hourlyOverage > 0 || dailyOverage > 0 || monthlyOverage > 0 || dailyRequestOverage > 0) {
      status = 'overage';
    } else if (maxPercent >= 100) {
      status = 'critical';
    } else if (maxPercent >= 80) {
      status = 'warning';
    }

    // Check Polar sync status
    let lastPolarSync: string | undefined;
    if (polarCustomerId) {
      const { data: syncData } = await supabase
        .from('usage_events')
        .select('created_at')
        .eq('external_customer_id', polarCustomerId)
        .eq('is_polar_synced', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single() as any;

      if (syncData?.created_at) {
        lastPolarSync = new Date(syncData.created_at * 1000).toISOString();
      }
    }

    const summary: UsageSummary = {
      userId,
      licenseNonce,
      tier,
      periodStart: defaultStart,
      periodEnd: defaultEnd,
      hourlyCredits,
      hourlyLimit: limits.hourlyCredits,
      hourlyOverage,
      dailyCredits,
      dailyLimit: limits.dailyCredits,
      dailyOverage,
      monthlyCredits,
      monthlyLimit: limits.monthlyCredits,
      monthlyOverage,
      dailyRequests,
      dailyRequestLimit: limits.dailyRequests,
      dailyRequestOverage,
      hourlyPercentage,
      dailyPercentage,
      monthlyPercentage,
      status,
      polarCustomerId: polarCustomerId || undefined,
      lastPolarSync,
    };

    logger.info('[Usage Aggregator] Aggregated usage for license', {
      licenseNonce: licenseNonce.slice(0, 8) + '...',
      tier,
      status,
      monthlyUsage: monthlyCredits,
      monthlyLimit: limits.monthlyCredits,
    });

    return summary;
  } catch (error) {
    logger.error('[Usage Aggregator] Failed to aggregate usage', error as Error);
    return null;
  }
}

/**
 * Detect overage events from usage summary
 */
export function detectOverageEvents(summary: UsageSummary): OverageDetected[] {
  const overages: OverageDetected[] = [];

  if (summary.hourlyOverage > 0) {
    overages.push({
      type: 'hourly_credits',
      limit: summary.hourlyLimit,
      current: summary.hourlyCredits,
      exceededBy: summary.hourlyOverage,
    });
  }

  if (summary.dailyOverage > 0) {
    overages.push({
      type: 'daily_credits',
      limit: summary.dailyLimit,
      current: summary.dailyCredits,
      exceededBy: summary.dailyOverage,
    });
  }

  if (summary.monthlyOverage > 0) {
    overages.push({
      type: 'monthly_credits',
      limit: summary.monthlyLimit,
      current: summary.monthlyCredits,
      exceededBy: summary.monthlyOverage,
    });
  }

  if (summary.dailyRequestOverage > 0) {
    overages.push({
      type: 'daily_requests',
      limit: summary.dailyRequestLimit,
      current: summary.dailyRequests,
      exceededBy: summary.dailyRequestOverage,
    });
  }

  return overages;
}

/**
 * Predict end-of-period usage based on current trends
 */
export function predictUsageForecast(
  summary: UsageSummary,
  daysIntoPeriod?: number
): UsageForecast {
  const now = new Date();
  const periodEnd = new Date(summary.periodEnd * 1000);
  const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Get days into period (default to current day of month)
  const daysElapsed = daysIntoPeriod || now.getDate();

  // Calculate daily average based on monthly usage
  const dailyAverage = summary.monthlyCredits / Math.max(1, daysElapsed);

  // Predict end-of-period usage
  const predictedUsage = dailyAverage * (daysElapsed + daysRemaining);

  // Calculate predicted overage
  const willExceedLimit = predictedUsage > summary.monthlyLimit;
  const predictedOverage = willExceedLimit ? predictedUsage - summary.monthlyLimit : undefined;

  // Generate recommendation
  let recommendation = 'Usage is within normal limits';

  if (willExceedLimit) {
    if (predictedOverage! > summary.monthlyLimit * 0.5) {
      recommendation = 'Critical: Consider upgrading plan immediately to avoid service interruption';
    } else if (predictedOverage! > summary.monthlyLimit * 0.2) {
      recommendation = 'Warning: You are projected to exceed your plan limits. Consider upgrading or reducing usage';
    } else {
      recommendation = 'Notice: You may slightly exceed your plan limits this period';
    }
  } else if (summary.monthlyPercentage > 80) {
    recommendation = 'Caution: You have used 80%+ of your monthly allocation';
  }

  return {
    predictedUsage: Math.round(predictedUsage),
    willExceedLimit,
    predictedOverage: predictedOverage ? Math.round(predictedOverage) : undefined,
    daysRemaining,
    dailyAverage: Math.round(dailyAverage),
    recommendation,
  };
}

/**
 * Get usage summary with overage detection and forecast
 */
export async function getUsageWithForecast(
  licenseNonce: string
): Promise<{
  summary: UsageSummary;
  overages: OverageDetected[];
  forecast: UsageForecast;
} | null> {
  const summary = await aggregateUsageForLicense(licenseNonce);
  if (!summary) {
    return null;
  }

  const overages = detectOverageEvents(summary);
  const forecast = predictUsageForecast(summary);

  return {
    summary,
    overages,
    forecast,
  };
}

/**
 * Calculate estimated overage charges
 */
export function calculateOverageEstimate(
  overages: OverageDetected[],
  tier: Tier
): { totalEstimate: number; breakdown: { type: string; units: number; rate: number; amount: number }[] } {
  // Tier-based pricing (matches overage-billing-reconciler.ts)
  const pricing = {
    BASIC: 0.10,
    PREMIUM: 0.05,
    ENTERPRISE: 0.03,
    MASTER: 0.02,
  };

  const rate = pricing[tier] || pricing.BASIC;
  const breakdown: { type: string; units: number; rate: number; amount: number }[] = [];
  let totalEstimate = 0;

  for (const overage of overages) {
    const amount = overage.exceededBy * rate;
    breakdown.push({
      type: overage.type,
      units: overage.exceededBy,
      rate,
      amount,
    });
    totalEstimate += amount;
  }

  return {
    totalEstimate,
    breakdown,
  };
}
