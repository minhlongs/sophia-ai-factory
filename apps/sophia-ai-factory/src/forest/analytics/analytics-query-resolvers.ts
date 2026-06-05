/**
 * Analytics GraphQL namespace resolvers (Query.analytics → Analytics.*).
 *
 * Handles usage, revenue, licenses, and ROI resolution with RBAC checks.
 * Consumed by graphql-resolvers.ts.
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { fetchUsageMetrics, fetchRevenueMetrics, fetchLicenseMetrics } from '@/land/analytics/queries';
import {
  checkAdmin,
  canAccessRevenue,
  verifyLicenseAccess,
  getUserLicenseNonce,
  getAnalyticsAccess,
} from '@/land/analytics/rbac';
import { calculateRoiMetrics } from '@/land/analytics/roi-calculator';
import type {
  UsageFilters,
  AnalyticsGranularity,
  AiService,
  RevenuePeriod,
  LicenseStatus,
  LicenseFilters,
} from '@/land/analytics/types';

// -------------------------------------------------------------------------
// Auth context helper
// -------------------------------------------------------------------------

/**
 * Verify user authentication and return enriched user context.
 * Throws if unauthenticated.
 */
export async function getUserContext() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized - authentication required');

  const [isAdmin, tier] = await Promise.all([
    checkAdmin(user.id),
    getUserTier(user.id),
  ]);

  return {
    userId: user.id,
    tier,
    isAdmin,
    access: getAnalyticsAccess(tier, isAdmin),
  };
}

// -------------------------------------------------------------------------
// Analytics namespace resolver object
// -------------------------------------------------------------------------

export const AnalyticsResolvers = {
  /**
   * Resolve usage metrics
   */
  usage: async (
    _parent: unknown,
    args: {
      start: number;
      end: number;
      licenseNonce?: string;
      granularity?: AnalyticsGranularity;
      service?: AiService;
    }
  ) => {
    const user = await getUserContext();

    const dateRangeDays = (args.end - args.start) / 86400;
    if (dateRangeDays > 90) throw new Error('Date range exceeds maximum of 90 days');

    let queryLicenseNonce = args.licenseNonce;
    if (!user.isAdmin) {
      if (args.licenseNonce) {
        const access = await verifyLicenseAccess(user.userId, args.licenseNonce, user.isAdmin);
        if (!access.allowed) throw new Error(access.error || 'Access denied');
      } else {
        queryLicenseNonce = await getUserLicenseNonce(user.userId) || undefined;
      }
    }

    const filters: UsageFilters = {
      licenseNonce:    queryLicenseNonce,
      startTimestamp:  args.start,
      endTimestamp:    args.end,
      granularity:     args.granularity || 'hour',
      service:         args.service,
    };

    return fetchUsageMetrics(filters);
  },

  /**
   * Resolve revenue metrics
   */
  revenue: async (
    _parent: unknown,
    args: { period?: RevenuePeriod; tier?: string }
  ) => {
    const user = await getUserContext();

    if (!canAccessRevenue(user.tier, user.isAdmin)) {
      throw new Error('Access denied - revenue metrics require ENTERPRISE tier or higher');
    }
    if (args.tier && !user.isAdmin) {
      throw new Error('Access denied - tier filter is admin-only');
    }

    const metrics = await fetchRevenueMetrics(args.period || 'current_month');

    if (args.tier && user.isAdmin) {
      metrics.byTier = metrics.byTier.filter((t) => t.tier === args.tier);
    }

    return metrics;
  },

  /**
   * Resolve license metrics
   */
  licenses: async (
    _parent: unknown,
    args: { status?: LicenseStatus; tier?: string }
  ) => {
    const user = await getUserContext();

    const filters: LicenseFilters = { status: args.status || 'active' };
    if (user.isAdmin && args.tier) filters.tier = args.tier;

    const metrics = await fetchLicenseMetrics(filters);

    if (!user.isAdmin) {
      const { createServerClient } = await import('@/seed/db/client');
      const db = createServerClient();

      const { data: userLicenses } = await db
        .from('raas_licenses')
        .select('nonce')
        .eq('created_by', user.userId);

      interface LicenseRow { nonce: string; }
      const userNonces = new Set(userLicenses?.map((l: unknown) => (l as LicenseRow).nonce) || []);

      metrics.utilization = metrics.utilization.filter((u) => userNonces.has(u.licenseNonce));
      metrics.total = metrics.utilization.length;

      const newByTier: Record<string, number> = {};
      for (const u of metrics.utilization) {
        newByTier[u.tier] = (newByTier[u.tier] || 0) + 1;
      }
      metrics.byTier = newByTier;
    }

    return metrics;
  },

  /**
   * Resolve ROI metrics
   */
  roi: async (
    _parent: unknown,
    args: { licenseNonce: string }
  ) => {
    const user = await getUserContext();

    const access = await verifyLicenseAccess(user.userId, args.licenseNonce, user.isAdmin);
    if (!access.allowed) throw new Error(access.error || 'Access denied');

    return calculateRoiMetrics(args.licenseNonce);
  },
};
