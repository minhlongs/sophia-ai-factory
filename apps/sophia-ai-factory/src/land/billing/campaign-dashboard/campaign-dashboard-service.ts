/**
 * Campaign Dashboard Service
 *
 * Fetches and aggregates campaign analytics data for the dashboard.
 * Each user's campaigns are stored in raas_licenses table with user_id.
 */

import { createServerClient } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import type {
  CampaignDashboardData,
  CampaignSummaryMetrics,
  CampaignDashboardItem,
  CampaignPerformanceChart,
  CampaignDashboardFilters,
} from './campaign-dashboard-types';

/**
 * Fetch campaign dashboard data for the current user
 */
export async function fetchCampaignDashboardData(
  filters: CampaignDashboardFilters = {}
): Promise<CampaignDashboardData> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Authentication required');
  }

  const db = createServerClient();

  try {
    // Fetch campaigns for this user (licenses map to campaigns in RaaS model)
    const { data: campaignsData, error } = await db
      .from('raas_licenses')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      logger.error('[CampaignDashboard] Failed to fetch campaigns', new Error(error.message));
      throw new Error('Failed to fetch campaign data');
    }

    const rawCampaigns = campaignsData as Array<{
      id: string;
      nonce: string;
      tier: string;
      created_at: number;
      expires_at: number | null;
      is_revoked: number; // SQLite INTEGER 0/1
      metadata?: string;
    }> | null;

    if (!rawCampaigns || rawCampaigns.length === 0) {
      return {
        summary: {
          totalCampaigns: 0,
          activeCampaigns: 0,
          totalRevenue: 0,
          avgUtilization: 0,
          campaignsWithOverage: 0,
        },
        campaigns: [],
        performanceChart: [],
        topPerformers: [],
      };
    }

    // Apply filters
    let filteredCampaigns = rawCampaigns;
    if (filters.status && filters.status !== 'all') {
      const now = Math.floor(Date.now() / 1000);
      filteredCampaigns = rawCampaigns.filter(camp => {
        const isRevoked = camp.is_revoked === 1;
        switch (filters.status) {
          case 'active':
            return !isRevoked && (!camp.expires_at || camp.expires_at > now);
          case 'expired':
            return !isRevoked && camp.expires_at && camp.expires_at < now;
          case 'revoked':
            return isRevoked;
          default:
            return true;
        }
      });
    }
    if (filters.tier) {
      filteredCampaigns = filteredCampaigns.filter(camp => camp.tier === filters.tier);
    }

    // Fetch utilization metrics for each campaign from usage_events
    const campaigns: CampaignDashboardItem[] = await Promise.all(
      filteredCampaigns.map(async (camp) => {
        const { data: usageData } = await db
          .from('usage_events')
          .select('credits_used')
          .eq('license_nonce', camp.nonce)
          .gte('created_at', getMonthStartTimestamp());

        const usedCredits = (usageData as Array<{ credits_used: number }> | null)
          ?.reduce((sum, row) => sum + (row.credits_used || 0), 0) || 0;

        const { data: overageData } = await db
          .from('overage_events')
          .select('exceeded_by, billable')
          .eq('license_nonce', camp.nonce)
          .gte('created_at', getMonthStartTimestamp());

        const overageEvents = overageData as Array<{ exceeded_by: number; billable: number }> | null;
        const overageCount = overageEvents?.length || 0;
        const billableCount = overageEvents?.filter(e => e.billable === 1).length || 0;
        const overageCredits = overageEvents?.reduce((sum, e) => sum + (e.exceeded_by || 0), 0) || 0;

        const tierQuota = getTierQuota(camp.tier);
        const percentage = tierQuota > 0 ? Math.min(Math.round((usedCredits / tierQuota) * 100), 100) : 0;

        const metadata = camp.metadata ? parseJsonSafely<{ title?: string; name?: string }>(camp.metadata, {}) : {};
        const now = Math.floor(Date.now() / 1000);
        const isRevoked = camp.is_revoked === 1;
        const isExpired = camp.expires_at && camp.expires_at < now;

        return {
          id: camp.nonce,
          licenseNonce: camp.nonce,
          tier: camp.tier,
          usedCredits,
          limitCredit: tierQuota,
          percentage,
          expiresAt: camp.expires_at,
          overageCount,
          billableCount,
          overageCredits,
          title: metadata.title || metadata.name || `Campaign ${camp.nonce.slice(0, 8)}`,
          status: isRevoked ? 'revoked' : (isExpired ? 'expired' : 'active'),
          createdAt: camp.created_at,
        };
      })
    );

    // Calculate summary metrics
    const summary: CampaignSummaryMetrics = {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status === 'active').length,
      totalRevenue: campaigns.reduce((sum, c) => sum + (c.billableCount ? (c.overageCredits || 0) : 0), 0),
      avgUtilization: campaigns.length > 0
        ? Math.round(campaigns.reduce((sum, c) => sum + c.percentage, 0) / campaigns.length)
        : 0,
      campaignsWithOverage: campaigns.filter(c => (c.overageCount || 0) > 0).length,
    };

    // Generate performance chart (last 30 days) - mock for now
    const performanceChart = generateMockPerformanceChart();

    // Top performers by utilization
    const topPerformers = [...campaigns]
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5);

    return {
      summary,
      campaigns: campaigns.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (b.status === 'active' && a.status !== 'active') return 1;
        return b.createdAt - a.createdAt;
      }),
      performanceChart,
      topPerformers,
    };
  } catch (error) {
    logger.error('[CampaignDashboard] Error fetching dashboard data', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Fetch single campaign details
 */
export async function fetchCampaignDetails(
  campaignId: string
): Promise<CampaignDashboardItem | null> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Authentication required');
  }

  const db = createServerClient();

  try {
    const { data, error } = await db
      .from('raas_licenses')
      .select('*')
      .eq('nonce', campaignId)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return null;
    }

    const camp = data as {
      nonce: string;
      tier: string;
      created_at: number;
      expires_at: number | null;
      is_revoked: number;
      metadata?: string;
    };

    const { data: usageData } = await db
      .from('usage_events')
      .select('credits_used')
      .eq('license_nonce', camp.nonce)
      .gte('created_at', getMonthStartTimestamp());

    const usedCredits = (usageData as Array<{ credits_used: number }> | null)
      ?.reduce((sum, row) => sum + (row.credits_used || 0), 0) || 0;

    const { data: overageData } = await db
      .from('overage_events')
      .select('exceeded_by, billable')
      .eq('license_nonce', camp.nonce)
      .gte('created_at', getMonthStartTimestamp());

    const overageEvents = overageData as Array<{ exceeded_by: number; billable: number }> | null;
    const overageCount = overageEvents?.length || 0;
    const billableCount = overageEvents?.filter(e => e.billable === 1).length || 0;
    const overageCredits = overageEvents?.reduce((sum, e) => sum + (e.exceeded_by || 0), 0) || 0;

    const tierQuota = getTierQuota(camp.tier);
    const percentage = tierQuota > 0 ? Math.min(Math.round((usedCredits / tierQuota) * 100), 100) : 0;
    const metadata = camp.metadata ? parseJsonSafely<{ title?: string; name?: string }>(camp.metadata, {}) : {};
    const now = Math.floor(Date.now() / 1000);
    const isRevoked = camp.is_revoked === 1;
    const isExpired = camp.expires_at && camp.expires_at < now;

    return {
      id: camp.nonce,
      licenseNonce: camp.nonce,
      tier: camp.tier,
      usedCredits,
      limitCredit: tierQuota,
      percentage,
      expiresAt: camp.expires_at,
      overageCount,
      billableCount,
      overageCredits,
      title: metadata.title || metadata.name || `Campaign ${camp.nonce.slice(0, 8)}`,
      status: isRevoked ? 'revoked' : (isExpired ? 'expired' : 'active'),
      createdAt: camp.created_at,
    };
  } catch (error) {
    logger.error('[CampaignDashboard] Failed to fetch campaign details', error instanceof Error ? error : new Error(String(error)));
    return null;
  };
}

/**
 * Get month start timestamp (Unix seconds)
 */
function getMonthStartTimestamp(): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return Math.floor(monthStart.getTime() / 1000);
}

/**
 * Get tier quota (credits per month)
 */
function getTierQuota(tier: string): number {
  const quotas: Record<string, number> = {
    BASIC: 100000,
    PREMIUM: 500000,
    ENTERPRISE: 2000000,
    MASTER: 5000000,
  };
  return quotas[tier.toUpperCase()] || quotas.BASIC;
}

/**
 * Parse JSON safely
 */
function parseJsonSafely<T = Record<string, unknown>>(str: string | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/**
 * Generate mock performance chart data for the last 30 days
 */
function generateMockPerformanceChart(): CampaignPerformanceChart[] {
  const days = 30;
  const chart: CampaignPerformanceChart[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    chart.push({
      date: date.toISOString().split('T')[0]!,
      revenue: Math.floor(Math.random() * 1000),
      views: Math.floor(Math.random() * 5000) + 1000,
      conversions: Math.floor(Math.random() * 50) + 10,
    });
  }

  return chart;
}
