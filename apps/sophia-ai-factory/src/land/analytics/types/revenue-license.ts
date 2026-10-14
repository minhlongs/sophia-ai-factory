/**
 * Analytics API Types — Revenue & License Metrics
 *
 * @module land/analytics/types/revenue-license
 */

export type RevenuePeriod = 'current_month' | 'last_month' | 'last_7_days' | 'last_30_days';

export interface TierRevenue {
  tier: string;
  customers: number;
  revenue: number;
}

export interface RevenueTrend {
  date: string; // YYYY-MM-DD
  revenue: number;
}

export interface RevenueMetrics {
  totalRevenue: number;
  recurringRevenue: number; // MRR
  oneTimeRevenue: number;
  byTier: TierRevenue[];
  trend: RevenueTrend[];
}

export type LicenseStatus = 'active' | 'expired' | 'revoked' | 'all';

export interface LicenseFilters {
  status?: LicenseStatus;
  tier?: string;
}

export type { LicenseUtilization } from '@/seed/types/license-utilization';
import type { LicenseUtilization } from '@/seed/types/license-utilization';

export interface LicenseMetrics {
  total: number;
  byTier: Record<string, number>;
  utilization: LicenseUtilization[];
}
