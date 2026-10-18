/**
 * @module forest/dashboard/metrics/metrics-service
 * D1 dashboard query coordinator and user session wrapper.
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  DashboardResult,
  DashboardData,
  DashboardFetchParams,
  DashboardTimeframe,
} from './types';
import {
  fetchCampaignMetrics,
  fetchRecentCampaigns,
} from './video-metrics-aggregator';
import {
  fetchRecentTransactions,
  fetchRevenueData,
  fetchTopAffiliates,
} from './revenue-metrics-aggregator';
import {
  buildDashboardSummaryMetrics,
  mergeRecentActivities,
} from './metrics-formatter';

/**
 * Fetch all dashboard data for a user
 */
export async function fetchDashboardData(
  params: DashboardFetchParams
): Promise<DashboardResult<DashboardData>> {
  const { userId, timeframe = 'month', limit = 10 } = params;

  try {
    const [
      campaignMetricsResult,
      recentCampaignsResult,
      transactionsResult,
      affiliatesResult,
      revenueResult,
    ] = await Promise.all([
      fetchCampaignMetrics(userId),
      fetchRecentCampaigns(userId, limit),
      fetchRecentTransactions(userId, limit),
      fetchTopAffiliates(userId, limit),
      fetchRevenueData(userId, timeframe),
    ]);

    if (!campaignMetricsResult.ok) return campaignMetricsResult;
    if (!recentCampaignsResult.ok) return recentCampaignsResult;
    if (!transactionsResult.ok) return transactionsResult;
    if (!affiliatesResult.ok) return affiliatesResult;

    const metrics = buildDashboardSummaryMetrics(campaignMetricsResult.data);
    const recentActivities = mergeRecentActivities(
      recentCampaignsResult.data,
      transactionsResult.data,
      limit,
    );

    return {
      ok: true,
      data: {
        metrics,
        campaignMetrics: campaignMetricsResult.data,
        recentActivities,
        topAffiliates: affiliatesResult.data,
        revenueData: revenueResult.ok ? revenueResult.data : [],
        timeframe,
      },
    };
  } catch (error) {
    logger.error('[dashboard] Failed to fetch dashboard data', toError(error));
    return {
      ok: false,
      error: 'Failed to fetch dashboard data',
      details: { error: String(error) },
    };
  }
}

/**
 * Get dashboard data for the current authenticated user
 */
export async function fetchCurrentUserDashboard(
  timeframe?: DashboardTimeframe,
  limit: number = 10
): Promise<DashboardResult<DashboardData>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { ok: false, error: 'Unauthenticated' };
    }

    return fetchDashboardData({
      userId: user.id,
      timeframe,
      limit,
    });
  } catch (error) {
    logger.error('[dashboard] Auth error in fetchCurrentUserDashboard', toError(error));
    return {
      ok: false,
      error: 'Authentication failed',
    };
  }
}
