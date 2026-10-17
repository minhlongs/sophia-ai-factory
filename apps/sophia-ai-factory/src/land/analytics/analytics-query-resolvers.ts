/**
 * Analytics GraphQL namespace resolvers (Query.analytics → Analytics.*).
 *
 * Handles usage, revenue, licenses, and ROI resolution with RBAC checks.
 * Consumed by graphql-resolvers.ts.
 */

import { fetchUsageMetrics, fetchRevenueMetrics, fetchLicenseMetrics } from '@/land/analytics/queries';
import { canAccessRevenue, verifyLicenseAccess } from '@/land/analytics/rbac';
import { calculateRoiMetrics } from '@/land/analytics/roi-calculator';
import {
  getUserContext,
  resolveUsageLicenseNonce,
  scopeLicenseMetricsToUser,
} from '@/land/analytics/analytics-resolver-helpers';
import type {
  UsageFilters,
  AnalyticsGranularity,
  AiService,
  RevenuePeriod,
  LicenseStatus,
  LicenseFilters,
} from '@/land/analytics/types';

export { getUserContext };

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

    const queryLicenseNonce = await resolveUsageLicenseNonce(
      user.userId,
      user.isAdmin,
      args.licenseNonce
    );

    const filters: UsageFilters = {
      licenseNonce:   queryLicenseNonce,
      startTimestamp: args.start,
      endTimestamp:   args.end,
      granularity:    args.granularity || 'hour',
      service:        args.service,
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
      return scopeLicenseMetricsToUser(user.userId, metrics);
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
