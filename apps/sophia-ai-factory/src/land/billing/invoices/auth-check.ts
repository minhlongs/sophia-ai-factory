/**
 * Enterprise Invoice RBAC & Access Control
 * @module land/billing/invoices/auth-check
 */

import type { D1Database } from '@cloudflare/workers-types';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getUserTier } from '@/seed/db/get-user-tier';
import { success, failure, type Result } from '@/seed/types/result';
import {
  hasEnterprisePermission,
  isEnterpriseRole,
  type EnterpriseRole,
} from '@/seed/types/enterprise-rbac';

export interface BillingActionError {
  code: string;
  message: string;
}

/**
 * Asserts that the current user has permission to manage or view billing for the org.
 * Enforces authentication, admin/role permission (canManageBilling), and tier gating.
 */
export async function assertBillingAccess(
  db: D1Database,
  orgId: string,
): Promise<Result<{ userId: string; isAdmin: boolean }, BillingActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (isAdmin || user.role === 'admin') {
    return success({ userId: user.id, isAdmin: true });
  }

  // 1. Verify organization membership & role
  const isSoloOrg = orgId === `org-${user.id}`;
  let hasBillingRole = isSoloOrg;

  if (!isSoloOrg) {
    const member = await db
      .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
      .bind(orgId, user.id)
      .first<{ role: string }>();

    if (!member) {
      return failure({
        code: 'FORBIDDEN',
        message: 'You do not belong to this organization.',
      });
    }

    const role = member.role;
    const isTraditionalAdmin = role === 'owner' || role === 'admin';
    const isEnterpriseBillingAdmin =
      role === 'enterprise_admin' ||
      (isEnterpriseRole(role) && hasEnterprisePermission(role as EnterpriseRole, 'canManageBilling'));

    hasBillingRole = isTraditionalAdmin || isEnterpriseBillingAdmin;
  }

  if (!hasBillingRole) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Your role lacks permission to manage enterprise billing and invoices.',
    });
  }

  // 2. Tier gating check (Enterprise/Master or active paid subscription)
  const userTier = await getUserTier(user.id);
  const subRow = await db
    .prepare('SELECT plan, status FROM subscriptions WHERE org_id = ?1 LIMIT 1')
    .bind(orgId)
    .first<{ plan: string; status: string }>();

  const eligiblePlans = ['enterprise', 'master', 'agency', 'pro', 'premium', 'growth', 'starter', 'basic'];
  const orgPlan = (subRow?.plan || '').toLowerCase();
  const orgStatus = subRow?.status || '';

  const isTierEligible =
    userTier === 'ENTERPRISE' ||
    userTier === 'MASTER' ||
    (orgStatus === 'active' && eligiblePlans.includes(orgPlan));

  if (!isTierEligible && !isSoloOrg) {
    return failure({
      code: 'TIER_REQUIRED',
      message: 'Enterprise E-Invoicing requires an active paid tier or Enterprise/Master subscription.',
    });
  }

  return success({ userId: user.id, isAdmin: false });
}
