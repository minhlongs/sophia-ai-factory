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
  DashboardMetric,
  RecentActivity,
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

    const metrics: DashboardMetric[] = [
      {
        id: 'total_campaigns',
        value: campaignMetricsResult.data.totalCampaigns.toString(),
        trend: 'neutral',
        icon: 'Megaphone',
      },
      {
        id: 'active_campaigns',
        value: campaignMetricsResult.data.activeCampaigns.toString(),
        trend: campaignMetricsResult.data.activeCampaigns > 0 ? 'up' : 'neutral',
        icon: 'Play',
      },
      {
        id: 'videos_generated',
        value: campaignMetricsResult.data.totalVideosGenerated.toString(),
        trend: 'up',
        icon: 'Video',
      },
      {
        id: 'success_rate',
        value: `${campaignMetricsResult.data.successRate.toFixed(1)}%`,
        trend: campaignMetricsResult.data.successRate >= 80 ? 'up' : 'down',
        icon: 'TrendingUp',
      },
    ];

    const recentActivities: RecentActivity[] = [
      ...recentCampaignsResult.data.map(c => ({
        id: c.id,
        type: 'campaign' as const,
        date: c.created_at,
        description: `Campaign: ${c.title}`,
        status: c.status,
      })),
      ...transactionsResult.data.map(t => ({
        id: t.id,
        type: 'payment' as const,
        date: t.date,
        description: t.customer,
        amount: t.amount,
        status: t.status,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      ok: true,
      data: {
        metrics,
        campaignMetrics: campaignMetricsResult.data,
        recentActivities: recentActivities.slice(0, limit),
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
