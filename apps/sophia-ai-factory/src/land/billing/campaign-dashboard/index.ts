/**
 * Campaign Dashboard Module
 *
 * Provides campaign analytics and performance data for the dashboard.
 */

export { fetchCampaignDashboardData, fetchCampaignDetails } from './campaign-dashboard-service';
export type {
  CampaignDashboardData,
  CampaignDashboardFilters,
  CampaignDashboardItem,
  CampaignSummaryMetrics,
  CampaignPerformanceChart,
} from './campaign-dashboard-types';
