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
