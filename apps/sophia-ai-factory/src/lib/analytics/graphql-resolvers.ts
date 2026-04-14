/**
 * GraphQL Resolvers for Analytics API
 *
 * Resolves GraphQL queries to analytics data functions
 */

import { getCurrentUser } from '@/lib/better-auth-session';
import { getUserTier } from '@/lib/db/get-user-tier';
import { fetchUsageMetrics, fetchRevenueMetrics, fetchLicenseMetrics } from '@/lib/analytics/queries';
import {
  checkAdmin,
  canAccessRevenue,
  verifyLicenseAccess,
  getUserLicenseNonce,
  getAnalyticsAccess,
} from '@/lib/analytics/rbac';
import { calculateRoiMetrics } from '@/lib/analytics/roi-calculator';
import type {
  UsageFilters,
  AnalyticsGranularity,
  AiService,
  RevenuePeriod,
  LicenseStatus,
  LicenseFilters,
} from '@/lib/analytics/types';

/**
 * Verify user authentication and return user context
 */
async function getUserContext() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Unauthorized - authentication required');
  }

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

/**
 * Analytics Query Resolvers
 */
export const resolvers = {
  Query: {
    analytics: () => ({}), // Analytics namespace resolver
  },

  Analytics: {
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

      // Validate date range (max 90 days)
      const dateRangeDays = (args.end - args.start) / 86400;
      if (dateRangeDays > 90) {
        throw new Error('Date range exceeds maximum of 90 days');
      }

      // RBAC: Verify license access
      let queryLicenseNonce = args.licenseNonce;

      if (!user.isAdmin) {
        if (args.licenseNonce) {
          const access = await verifyLicenseAccess(user.userId, args.licenseNonce, user.isAdmin);
          if (!access.allowed) {
            throw new Error(access.error || 'Access denied');
          }
        } else {
          // Auto-inject user's own license
          queryLicenseNonce = await getUserLicenseNonce(user.userId) || undefined;
        }
      }

      // Build filters
      const filters: UsageFilters = {
        licenseNonce: queryLicenseNonce,
        startTimestamp: args.start,
        endTimestamp: args.end,
        granularity: args.granularity || 'hour',
        service: args.service,
      };

      // Fetch metrics
      const metrics = await fetchUsageMetrics(filters);

      return metrics;
    },

    /**
     * Resolve revenue metrics
     */
    revenue: async (
      _parent: unknown,
      args: {
        period?: RevenuePeriod;
        tier?: string;
      }
    ) => {
      const user = await getUserContext();

      // RBAC: Check revenue access
      if (!canAccessRevenue(user.tier, user.isAdmin)) {
        throw new Error('Access denied - revenue metrics require ENTERPRISE tier or higher');
      }

      // RBAC: Tier filter is admin-only
      if (args.tier && !user.isAdmin) {
        throw new Error('Access denied - tier filter is admin-only');
      }

      // Fetch metrics
      const metrics = await fetchRevenueMetrics(args.period || 'current_month');

      // Apply tier filter if requested (admin only)
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
      args: {
        status?: LicenseStatus;
        tier?: string;
      }
    ) => {
      const user = await getUserContext();

      // Build filters
      const filters: LicenseFilters = {
        status: args.status || 'active',
      };

      // Admins can filter by tier
      if (user.isAdmin && args.tier) {
        filters.tier = args.tier;
      }

      // Fetch metrics
      const metrics = await fetchLicenseMetrics(filters);

      // Non-admin users only see their own licenses
      if (!user.isAdmin) {
        const { createServerClient } = await import('@/lib/db/client');
        const db = createServerClient();

        const { data: userLicenses } = await db
          .from('raas_licenses')
          .select('nonce')
          .eq('created_by', user.userId);

        interface LicenseRow {
          nonce: string;
        }

        const userNonces = new Set(userLicenses?.map((l: LicenseRow) => l.nonce) || []);

        metrics.utilization = metrics.utilization.filter(
          (u) => userNonces.has(u.licenseNonce)
        );

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
      args: {
        licenseNonce: string;
      }
    ) => {
      const user = await getUserContext();

      // RBAC: Verify license access
      const access = await verifyLicenseAccess(user.userId, args.licenseNonce, user.isAdmin);
      if (!access.allowed) {
        throw new Error(access.error || 'Access denied');
      }

      // Calculate ROI metrics
      const roiMetrics = await calculateRoiMetrics(args.licenseNonce);

      return roiMetrics;
    },
  },
};
