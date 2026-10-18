/**
 * Analytics Admin and Feature Check Helpers
 *
 * @module forest/analytics/rbac-admin
 */

import type { Tier } from '@/seed/types';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';

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
