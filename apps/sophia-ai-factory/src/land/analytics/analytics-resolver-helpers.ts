/**
 * Analytics GraphQL auth context and tenant scoping helpers.
 * @module land/analytics/analytics-resolver-helpers
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import {
  checkAdmin,
  verifyLicenseAccess,
  getUserLicenseNonce,
  getAnalyticsAccess,
} from '@/land/analytics/rbac';
import type { LicenseMetrics } from '@/land/analytics/types';

/**
 * Verify user authentication and return enriched user context.
 * Throws if unauthenticated.
 */
export async function getUserContext() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized - authentication required');

  const [isAdmin, tier] = await Promise.all([
    checkAdmin(user.id),
    resolveUserTier(user.id),
  ]);

  return {
    userId: user.id,
    tier,
    isAdmin,
    access: getAnalyticsAccess(tier, isAdmin),
  };
}

/**
 * Resolve effective license nonce for usage query with RBAC verification.
 */
export async function resolveUsageLicenseNonce(
  userId: string,
  isAdmin: boolean,
  requestedNonce?: string
): Promise<string | undefined> {
  if (isAdmin) return requestedNonce;
  if (requestedNonce) {
    const access = await verifyLicenseAccess(userId, requestedNonce, isAdmin);
    if (!access.allowed) throw new Error(access.error || 'Access denied');
    return requestedNonce;
  }
  return (await getUserLicenseNonce(userId)) || undefined;
}

/**
 * Filter license metrics down to non-admin user's owned licenses.
 */
export async function scopeLicenseMetricsToUser(
  userId: string,
  metrics: LicenseMetrics
): Promise<LicenseMetrics> {
  const { createServerClient } = await import('@/seed/db/client');
  const db = createServerClient();

  const { data: userLicenses } = await db
    .from('raas_licenses')
    .select('nonce')
    .eq('created_by', userId);

  interface LicenseRow { nonce: string; }
  const userNonces = new Set(userLicenses?.map((l: unknown) => (l as LicenseRow).nonce) || []);

  metrics.utilization = metrics.utilization.filter((u) => userNonces.has(u.licenseNonce));
  metrics.total = metrics.utilization.length;

  const newByTier: Record<string, number> = {};
  for (const u of metrics.utilization) {
    newByTier[u.tier] = (newByTier[u.tier] || 0) + 1;
  }
  metrics.byTier = newByTier;
  return metrics;
}
