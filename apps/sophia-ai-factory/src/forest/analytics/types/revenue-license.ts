/**
 * Analytics Revenue, License & Context Types
 *
 * Layer: forest/analytics/types
 */

export type RevenuePeriod = 'current_month' | 'last_month' | 'last_7_days' | 'last_30_days';

export interface TierRevenue {
  tier: string;
  customers: number;
  revenue: number;
}

export interface RevenueTrend {
  date: string;
  revenue: number;
}

export interface RevenueMetrics {
  totalRevenue: number;
  recurringRevenue: number;
  oneTimeRevenue: number;
  byTier: TierRevenue[];
  trend: RevenueTrend[];
}

export type LicenseStatus = 'active' | 'expired' | 'revoked' | 'all';

export interface LicenseFilters {
  status?: LicenseStatus;
  tier?: string;
}

export interface LicenseUtilization {
  licenseNonce: string;
  tier: string;
  usedCredits: number;
  limitCredit: number;
  percentage: number;
  expiresAt: number | null;
  overageCount?: number;
  billableCount?: number;
  overageCredits?: number;
}

export interface LicenseMetrics {
  total: number;
  byTier: Record<string, number>;
  utilization: LicenseUtilization[];
}

export interface AnalyticsErrorResponse {
  error: string;
  details?: Record<string, string>;
}

export interface UserContext {
  userId: string;
  tier: string;
  is_admin: boolean;
}
