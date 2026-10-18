/**
 * Analytics RBAC (Role-Based Access Control) Helpers
 *
 * Access control utilities for analytics dashboard
 *
 * @module forest/analytics/rbac
 */

import { Tier } from '@/seed/types';
import { verifyLicenseAccess, getUserLicenseNonce } from './rbac-license';
import { checkAdmin, canAccessRevenue, canExport } from './rbac-admin';

export { verifyLicenseAccess, getUserLicenseNonce, checkAdmin, canAccessRevenue, canExport };

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

/**
 * Get analytics feature access based on user tier and admin status
 */
export function getAnalyticsAccess(
  tier: Tier,
  isAdmin: boolean
): AnalyticsFeatureAccess {
  // Admin gets everything + customer table
  if (isAdmin) {
    return {
      canViewCustomDateRange: true,
      canViewTimeSeries: true,
      canViewTierBreakdown: true,
      canViewCustomerTable: true,
      canViewRevenue: true,
      canExport: true,
      canAutoRefresh: true,
      canViewRoi: true,
    };
  }

  // MASTER tier gets everything (except customer table which is admin-only)
  if (tier === 'MASTER') {
    return {
      canViewCustomDateRange: true,
      canViewTimeSeries: true,
      canViewTierBreakdown: true,
      canViewCustomerTable: false,
      canViewRevenue: true,
      canExport: true,
      canAutoRefresh: true,
      canViewRoi: true,
    };
  }

  // ENTERPRISE tier
  if (tier === 'ENTERPRISE') {
    return {
      canViewCustomDateRange: true,
      canViewTimeSeries: true,
      canViewTierBreakdown: true,
      canViewCustomerTable: false,
      canViewRevenue: true,
      canExport: true,
      canAutoRefresh: true,
      canViewRoi: true,
    };
  }

  // PREMIUM tier
  if (tier === 'PREMIUM') {
    return {
      canViewCustomDateRange: true,
      canViewTimeSeries: true,
      canViewTierBreakdown: false,
      canViewCustomerTable: false,
      canViewRevenue: false,
      canExport: true,
      canAutoRefresh: false,
      canViewRoi: false,
    };
  }

  // BASIC tier (default)
  return {
    canViewCustomDateRange: false,
    canViewTimeSeries: true, // Basic chart only
    canViewTierBreakdown: false,
    canViewCustomerTable: false,
    canViewRevenue: false,
    canExport: false,
    canAutoRefresh: false,
    canViewRoi: false,
  };
}
