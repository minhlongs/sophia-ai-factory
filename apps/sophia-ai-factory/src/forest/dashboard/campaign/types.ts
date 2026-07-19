/**
 * Types specific to campaign UI components
 */

import type { Campaign, CampaignStatus, CampaignFilter } from '@/seed/types';

/**
 * Props for CampaignStatusBadge
 */
export interface CampaignStatusBadgeProps {
  status: CampaignStatus;
  className?: string;
  label?: string;
}

/**
 * Props for CampaignProgressBar
 */
export interface CampaignProgressBarProps {
  progress: number; // 0-100
  status?: CampaignStatus;
  className?: string;
}

/**
 * Props for CampaignCard
 */
export interface CampaignCardProps {
  campaign: Campaign;
  onSelect: (campaign: Campaign) => void;
  className?: string;
}

/**
 * Props for CampaignGrid
 */
export interface CampaignGridProps {
  campaigns: Campaign[];
  onCampaignSelect: (campaign: Campaign) => void;
  className?: string;
}

/**
 * Props for CampaignFilterTabs
 */
export interface CampaignFilterTabsProps {
  value: CampaignFilter;
  onChange: (value: CampaignFilter) => void;
}

/**
 * Metrics for CampaignMetricsCard
 */
export type CampaignDashboardMetrics = {
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
  failedCampaigns: number;
  successRate: number; // percentage
};

/**
 * Props for CampaignMetricsCard
 */
export interface CampaignMetricsCardProps {
  metrics: CampaignDashboardMetrics;
  className?: string;
}

/**
 * Analytics summary for campaign dashboard
 */
export interface CampaignAnalytics {
  totalCampaigns: number;
  successRate: number; // %
  avgCompletionTimeHours: number;
  statusDistribution: Record<string, number>;
  recentCampaigns: CampaignSummary[];
  completedCount: number;
  failedCount: number;
}

/**
 * Summary of a single campaign for table display
 */
export interface CampaignSummary {
  id: string;
  name: string;
  status: string;
  platform: string;
  createdAt: string;
  completedAt: string | null;
}

/**
 * Props for AnalyticsStatsCards
 */
export interface AnalyticsStatsCardsProps {
  totalCampaigns: number;
  successRate: number;
  avgCompletionTimeHours: number;
  completedCount: number;
  failedCount: number;
  className?: string;
}

/**
 * Props for AnalyticsStatusChart
 */
export interface AnalyticsStatusChartProps {
  data: { name: string; value: number }[];
  className?: string;
}

/**
 * Props for AnalyticsPerformanceChart
 */
export interface AnalyticsPerformanceChartProps {
  data: { name: string; duration: number }[];
  className?: string;
}

/**
 * Props for AnalyticsRecentCampaigns
 */
export interface AnalyticsRecentCampaignsProps {
  campaigns: CampaignSummary[];
  maxRows?: number;
  className?: string;
}
