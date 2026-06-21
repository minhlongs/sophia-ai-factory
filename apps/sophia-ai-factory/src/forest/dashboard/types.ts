/**
 * @module forest/dashboard
 * Dashboard data orchestration - metrics, stats, aggregations
 *
 * Layer: Forest (infrastructure orchestrators)
 * Purpose: Provide dashboard-specific data aggregations from seed/tree/land layers
 */

// Re-export types from seed where appropriate
export type { CampaignStatus } from '@/seed/types';
export type { Tier } from '@/seed/types';

/**
 * Dashboard metrics for the main overview card grid
 */
export interface DashboardMetric {
  id: string;
  value: string;
  change?: string;
  trend: 'up' | 'down' | 'neutral';
  icon: string; // Lucide icon name (maps to icon components in UI)
}

/**
 * Campaign-specific dashboard metrics
 */
export interface CampaignMetrics {
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
  failedCampaigns: number;
  totalVideosGenerated: number;
  successRate: number; // percentage
  lastCampaignDate?: string;
}

/**
 * Recent activity/transaction for dashboard tables
 */
export interface RecentActivity {
  id: string;
  type: 'campaign' | 'payment' | 'affiliate' | 'system';
  date: string;
  description: string;
  amount?: string;
  status: string;
}

/**
 * Top affiliate partner stats
 */
export interface AffiliateStats {
  id: string;
  name: string;
  initials: string;
  avatar?: string | null;
  stats: string; // e.g., "24 Sales • $1,200"
  commission: string;
}

/**
 * Composite dashboard data structure
 */
export interface DashboardData {
  metrics: DashboardMetric[];
  campaignMetrics: CampaignMetrics;
  recentActivities: RecentActivity[];
  topAffiliates: AffiliateStats[];
  timeframe?: 'week' | 'month' | 'quarter' | 'year';
}

/**
 * Time-based aggregation options
 */
export type DashboardTimeframe = 'week' | 'month' | 'quarter' | 'year';

/**
 * Request parameters for dashboard data fetching
 */
export interface DashboardFetchParams {
  userId: string;
  timeframe?: DashboardTimeframe;
  limit?: number;
}

/**
 * Error response shape for dashboard operations
 */
export interface DashboardError {
  ok: false;
  error: string;
  details?: Record<string, unknown>;
}

/**
 * Success response shape for dashboard operations
 */
export interface DashboardSuccess<T> {
  ok: true;
  data: T;
}

/**
 * Union type for dashboard operation results
 */
export type DashboardResult<T> = DashboardError | DashboardSuccess<T>;
