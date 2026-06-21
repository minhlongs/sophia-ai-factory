/**
 * @module forest/dashboard/metrics
 * Dashboard data fetching and aggregation functions
 *
 * Layer: Forest (infrastructure orchestrators)
 *
 * These functions aggregate data from various sources (D1, land modules) to power
 * the dashboard UI. They are pure TypeScript (no React) and can be called from
 * Server Actions or API routes.
 */

import { createServerClient } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { D1Database } from '@cloudflare/workers-types';
import type {
  DashboardResult,
  DashboardData,
  DashboardFetchParams,
  CampaignMetrics,
  DashboardMetric,
  RecentActivity,
  AffiliateStats,
  DashboardTimeframe,
} from './types';
import { Campaign } from '@/seed/types';

/**
 * Fetch all dashboard data for a user
 *
 * This is the main entry point for dashboard data. It orchestrates calls to
 * specialized functions and combines results.
 *
 * @param params - Fetch parameters including userId and optional timeframe
 * @returns DashboardResult<DashboardData>
 */
export async function fetchDashboardData(
  params: DashboardFetchParams
): Promise<DashboardResult<DashboardData>> {
  const { userId, timeframe = 'month', limit = 10 } = params;

  try {
    // Parallel fetch of independent data
    const [
      campaignMetricsResult,
      recentCampaignsResult,
      transactionsResult,
      affiliatesResult,
    ] = await Promise.all([
      fetchCampaignMetrics(userId),
      fetchRecentCampaigns(userId, limit),
      fetchRecentTransactions(userId, limit),
      fetchTopAffiliates(userId, limit),
    ]);

    // Check for errors in any sub-request
    if (!campaignMetricsResult.ok) return campaignMetricsResult;
    if (!recentCampaignsResult.ok) return recentCampaignsResult;
    if (!transactionsResult.ok) return transactionsResult;
    if (!affiliatesResult.ok) return affiliatesResult;

    // Transform into DashboardMetric array for main metrics grid
    const metrics: DashboardMetric[] = [
      {
        id: 'total_campaigns',
        label: 'Total Campaigns',
        value: campaignMetricsResult.data.totalCampaigns.toString(),
        trend: 'neutral',
        icon: 'Megaphone',
      },
      {
        id: 'active_campaigns',
        label: 'Active Campaigns',
        value: campaignMetricsResult.data.activeCampaigns.toString(),
        trend: campaignMetricsResult.data.activeCampaigns > 0 ? 'up' : 'neutral',
        icon: 'Play',
      },
      {
        id: 'videos_generated',
        label: 'Videos Generated',
        value: campaignMetricsResult.data.totalVideosGenerated.toString(),
        trend: 'up',
        icon: 'Video',
      },
      {
        id: 'success_rate',
        label: 'Success Rate',
        value: `${campaignMetricsResult.data.successRate.toFixed(1)}%`,
        trend: campaignMetricsResult.data.successRate >= 80 ? 'up' : 'down',
        icon: 'TrendingUp',
      },
    ];

    // Combine activities from campaigns and transactions
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
 * Fetch campaign-specific metrics
 */
export async function fetchCampaignMetrics(
  userId: string
): Promise<DashboardResult<CampaignMetrics>> {
  try {
    const db = createServerClient();

    const result = await db
      .from('campaigns')
      .select('id, status, created_at, video_url', { count: 'exact' })
      .eq('user_id', userId);

    if (result.error) {
      throw new Error(result.error.message);
    }

    const campaigns = (result.data as unknown as Campaign[]) || [];

    const total = campaigns.length;
    const completed = campaigns.filter(c => c.status === 'completed').length;
    const failed = campaigns.filter(c => c.status === 'failed').length;
    const active = campaigns.filter(c =>
      ['queued', 'processing_script', 'processing_video'].includes(c.status)
    ).length;
    const videosGenerated = campaigns.filter(c => !!c.video_url).length;

    // Success rate: completed / (completed + failed) avoiding division by zero
    const successRate = completed + failed > 0
      ? (completed / (completed + failed)) * 100
      : 0;

    const lastCampaign = campaigns
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    return {
      ok: true,
      data: {
        totalCampaigns: total,
        activeCampaigns: active,
        completedCampaigns: completed,
        failedCampaigns: failed,
        totalVideosGenerated: videosGenerated,
        successRate,
        lastCampaignDate: lastCampaign?.created_at || undefined,
      },
    };
  } catch (error) {
    logger.error('[dashboard] Failed to fetch campaign metrics', toError(error));
    return {
      ok: false,
      error: 'Failed to fetch campaign metrics',
    };
  }
}

/**
 * Fetch recent campaigns for a user
 */
export async function fetchRecentCampaigns(
  userId: string,
  limit: number = 10
): Promise<DashboardResult<Campaign[]>> {
  try {
    const db = createServerClient();

    const result = await db
      .from('campaigns')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (result.error) {
      throw new Error(result.error.message);
    }

    const campaigns = (result.data as unknown as Campaign[]) || [];

    return {
      ok: true,
      data: campaigns,
    };
  } catch (error) {
    logger.error('[dashboard] Failed to fetch recent campaigns', toError(error));
    return {
      ok: false,
      error: 'Failed to fetch recent campaigns',
    };
  }
}

/**
 * Fetch recent payment transactions
 * Note: This is a placeholder - actual transaction data source TBD
 * (could be from billing/transactions land module or D1 payments table)
 */
export async function fetchRecentTransactions(
  userId: string,
  limit: number = 10
): Promise<DashboardResult<{ id: string; date: string; customer: string; amount: string; status: string }[]>> {
  try {
    // Try to fetch from a transactions/payments table if it exists
    const db = createServerClient();

    // This is a speculative query - adjust based on actual schema
    const result = await db
      .from('transactions')
      .select('id, created_at, customer_name, amount_cents, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (result.error || !result.data) {
      // If no transactions table yet, return empty array (dashboard still works)
      return { ok: true, data: [] };
    }

    // Transform to expected shape
    const rows = result.data as Array<{
      id: string;
      created_at: string;
      customer_name: string;
      amount_cents: number;
      status: string;
    }>;

    const transactions = rows.map(row => ({
      id: row.id,
      date: row.created_at,
      customer: row.customer_name,
      amount: `$${(row.amount_cents / 100).toFixed(2)}`,
      status: row.status,
    }));

    return { ok: true, data: transactions };
  } catch (error) {
    // Return empty rather than fail - transactions are optional for dashboard
    logger.warn('[dashboard] Could not fetch transactions', toError(error));
    return { ok: true, data: [] };
  }
}

/**
 * Fetch top affiliate partners by commission
 */
export async function fetchTopAffiliates(
  userId: string,
  limit: number = 5
): Promise<DashboardResult<AffiliateStats[]>> {
  try {
    const db = createServerClient();

    // Query affiliates table ordered by total_commission or similar
    // This is speculative - adjust based on actual affiliate schema
    const result = await db
      .from('affiliates')
      .select('id, name, initials, avatar_url, stats, total_commission')
      .eq('user_id', userId)
      .order('total_commission', { ascending: false })
      .limit(limit);

    if (result.error || !result.data) {
      return { ok: true, data: [] };
    }

    const affiliates = (result.data as Array<{
      id: string;
      name: string;
      initials: string;
      avatar_url: string | null;
      stats: string;
      total_commission: number;
    }>).map(aff => ({
      id: aff.id,
      name: aff.name,
      initials: aff.initials,
      avatar: aff.avatar_url,
      stats: aff.stats,
      commission: `+$${aff.total_commission.toFixed(0)}`,
    }));

    return { ok: true, data: affiliates };
  } catch (error) {
    logger.warn('[dashboard] Could not fetch affiliates', toError(error));
    return { ok: true, data: [] };
  }
}

/**
 * Get dashboard data for the current authenticated user
 * Convenience wrapper that calls getCurrentUser internally
 *
 * @param timeframe - Optional time window for aggregations
 * @param limit - Max items in lists (default 10)
 * @returns DashboardResult<DashboardData>
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
