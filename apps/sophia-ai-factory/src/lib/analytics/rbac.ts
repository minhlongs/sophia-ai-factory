/**
 * Analytics RBAC (Role-Based Access Control) Helpers
 *
 * Access control utilities for analytics dashboard
 */

import { Tier } from '@/types';
import { getUserTier } from '@/lib/db/get-user-tier';

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
  const tier = await getUserTier(userId);
  if (tier === 'MASTER') {
    return true;
  }

  // Check for admin role in user profile
  const { createServerClient } = await import('@/lib/db/client');
  const db = createServerClient();

  const { data: profile } = await db
    .from('user_profiles')
    .select('role')
    .eq('user_id', userId)
    .single() as any;

  return profile?.role === 'admin';
}

/**
 * Verify user can access specific license data
 */
export async function verifyLicenseAccess(
  userId: string,
  licenseNonce: string,
  isAdmin: boolean
): Promise<{ allowed: boolean; error?: string }> {
  // Admins can access any license
  if (isAdmin) {
    return { allowed: true };
  }

  // Non-admin users can only access their own licenses
  const { createServerClient } = await import('@/lib/db/client');
  const db = createServerClient();

  const { data: license } = await db
    .from('raas_licenses')
    .select('created_by')
    .eq('nonce', licenseNonce)
    .single() as any;

  if (!license) {
    return { allowed: false, error: 'License not found' };
  }

  if (license.created_by !== userId) {
    return {
      allowed: false,
      error: 'Access denied - you can only view your own license data',
    };
  }

  return { allowed: true };
}

/**
 * Get user's own active license nonce
 */
export async function getUserLicenseNonce(userId: string): Promise<string | null> {
  const { createServerClient } = await import('@/lib/db/client');
  const db = createServerClient();

  const { data: license } = await db
    .from('raas_licenses')
    .select('nonce')
    .eq('created_by', userId)
    .eq('is_revoked', false)
    .order('created_at', { ascending: false })
    .single() as any;

  return license?.nonce || null;
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
