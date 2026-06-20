/**
 * Campaign Dashboard Types
 *
 * Types for campaign analytics dashboard data
 */

import type { LicenseMetrics, LicenseUtilization } from '@/land/analytics/types';

/**
 * Campaign summary metrics shown on the dashboard cards
 */
export interface CampaignSummaryMetrics {
  totalCampaigns: number;
  activeCampaigns: number;
  totalRevenue: number;
  avgUtilization: number;
  campaignsWithOverage: number;
}

/**
 * Campaign detail with utilization data
 */
export interface CampaignDashboardItem extends LicenseUtilization {
  id: string;
  title: string;
  status: 'active' | 'expired' | 'revoked';
  createdAt: number;
  updatedAt?: number; // Optional - not tracked in current schema
}

/**
 * Time series data for campaign performance chart
 */
export interface CampaignPerformanceChart {
  date: string; // YYYY-MM-DD
  revenue: number;
  views: number;
  conversions: number;
}

/**
 * Filters for campaign dashboard
 */
export interface CampaignDashboardFilters {
  status?: 'active' | 'expired' | 'revoked' | 'all';
  tier?: string;
  dateRange?: '7d' | '30d' | '90d' | 'all';
}

/**
 * Complete dashboard response
 */
export interface CampaignDashboardData {
  summary: CampaignSummaryMetrics;
  campaigns: CampaignDashboardItem[];
  performanceChart: CampaignPerformanceChart[];
  topPerformers: CampaignDashboardItem[];
}
