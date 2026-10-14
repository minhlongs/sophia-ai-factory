/**
 * Analytics RBAC (Role-Based Access Control) Helpers
 *
 * Access control utilities for analytics dashboard
 *
 * @module land/analytics/rbac
 */

import { Tier } from '@/seed/types';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { verifyLicenseAccess, getUserLicenseNonce } from './rbac-license';

export { verifyLicenseAccess, getUserLicenseNonce };

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

/**
 * Check if user is admin (MASTER tier or has admin role)
 */
export async function checkAdmin(userId: string): Promise<boolean> {
  // MASTER tier users are considered admins
  const tier = await resolveUserTier(userId);
  if (tier === 'MASTER') {
    return true;
  }

  // Check for admin role in user profile
  try {
    const { createServerClient } = await import('@/seed/db/client');
    const db = createServerClient();

    const { data: profile } = await db
      .from<{ role: string | null }>('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single();

    return profile?.role === 'admin';
  } catch {
    // Missing row or D1 error — default to not admin (fail closed)
    return false;
  }
}

/**
 * Check if user has access to revenue metrics
 */
export function canAccessRevenue(tier: Tier, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (tier === 'MASTER' || tier === 'ENTERPRISE') return true;
  return false;
}

/**
 * Check if user has access to export functionality
 */
export function canExport(tier: Tier, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (tier === 'PREMIUM' || tier === 'ENTERPRISE' || tier === 'MASTER') return true;
  return false;
}
