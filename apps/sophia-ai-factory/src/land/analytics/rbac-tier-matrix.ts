/**
 * Analytics RBAC Tier Feature Matrix
 *
 * Pure tier-to-feature capability mapping for analytics dashboard.
 *
 * @module land/analytics/rbac-tier-matrix
 */

import { Tier } from '@/seed/types';

/**
 * Analytics feature access levels
 */
export interface AnalyticsFeatureAccess {
  canViewCustomDateRange: boolean;
  canViewTimeSeries: boolean;
  canViewTierBreakdown: boolean;
  canViewCustomerTable: boolean;
  canViewRevenue: boolean;
  canExport: boolean;
  canAutoRefresh: boolean;
  canViewRoi: boolean;
}

const ADMIN_ACCESS: AnalyticsFeatureAccess = {
  canViewCustomDateRange: true,
  canViewTimeSeries: true,
  canViewTierBreakdown: true,
  canViewCustomerTable: true,
  canViewRevenue: true,
  canExport: true,
  canAutoRefresh: true,
  canViewRoi: true,
};

const TIER_ACCESS_MATRIX: Record<Tier, AnalyticsFeatureAccess> = {
  MASTER: {
    canViewCustomDateRange: true,
    canViewTimeSeries: true,
    canViewTierBreakdown: true,
    canViewCustomerTable: false,
    canViewRevenue: true,
    canExport: true,
    canAutoRefresh: true,
    canViewRoi: true,
  },
  ENTERPRISE: {
    canViewCustomDateRange: true,
    canViewTimeSeries: true,
    canViewTierBreakdown: true,
    canViewCustomerTable: false,
    canViewRevenue: true,
    canExport: true,
    canAutoRefresh: true,
    canViewRoi: true,
  },
  PREMIUM: {
    canViewCustomDateRange: true,
    canViewTimeSeries: true,
    canViewTierBreakdown: false,
    canViewCustomerTable: false,
    canViewRevenue: false,
    canExport: true,
    canAutoRefresh: false,
    canViewRoi: false,
  },
  BASIC: {
    canViewCustomDateRange: false,
    canViewTimeSeries: true,
    canViewTierBreakdown: false,
    canViewCustomerTable: false,
    canViewRevenue: false,
    canExport: false,
    canAutoRefresh: false,
    canViewRoi: false,
  },
};

/**
 * Resolve analytics feature access based on user tier and admin status
 */
export function resolveAnalyticsAccessMatrix(
  tier: Tier,
  isAdmin: boolean
): AnalyticsFeatureAccess {
  if (isAdmin) {
    return { ...ADMIN_ACCESS };
  }
  return { ...(TIER_ACCESS_MATRIX[tier] ?? TIER_ACCESS_MATRIX.BASIC) };
}
