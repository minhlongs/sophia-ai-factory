/**
 * @module forest/dashboard/metrics/metrics-formatter
 * Formatters for dashboard summary cards and recent activity feed.
 */

import type {
  CampaignMetrics,
  DashboardMetric,
  RecentActivity,
} from './types';

export function buildDashboardSummaryMetrics(
  campaignMetrics: CampaignMetrics,
): DashboardMetric[] {
  return [
    {
      id: 'total_campaigns',
      value: campaignMetrics.totalCampaigns.toString(),
      trend: 'neutral',
      icon: 'Megaphone',
    },
    {
      id: 'active_campaigns',
      value: campaignMetrics.activeCampaigns.toString(),
      trend: campaignMetrics.activeCampaigns > 0 ? 'up' : 'neutral',
      icon: 'Play',
    },
    {
      id: 'videos_generated',
      value: campaignMetrics.totalVideosGenerated.toString(),
      trend: 'up',
      icon: 'Video',
    },
    {
      id: 'success_rate',
      value: `${campaignMetrics.successRate.toFixed(1)}%`,
      trend: campaignMetrics.successRate >= 80 ? 'up' : 'down',
      icon: 'TrendingUp',
    },
  ];
}

export function mergeRecentActivities(
  recentCampaigns: Array<{ id: string; created_at: string; title: string; status: string }>,
  transactions: Array<{ id: string; date: string; customer: string; amount: string; status: string }>,
  limit: number,
): RecentActivity[] {
  const combined: RecentActivity[] = [
    ...recentCampaigns.map(c => ({
      id: c.id,
      type: 'campaign' as const,
      date: c.created_at,
      description: `Campaign: ${c.title}`,
      status: c.status,
    })),
    ...transactions.map(t => ({
      id: t.id,
      type: 'payment' as const,
      date: t.date,
      description: t.customer,
      amount: t.amount,
      status: t.status,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return combined.slice(0, limit);
}
