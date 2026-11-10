/**
 * Enterprise Invoice RBAC & Access Control
 * @module land/billing/invoices/auth-check
 */

import type { D1Database } from '@cloudflare/workers-types';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { enforceCommercialFeatureForUser } from '@/seed/config/enforce-commercial-feature-server';
import { getUserTier } from '@/seed/db/get-user-tier';
import type { Tier } from '@/seed/types';
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
 * Enforces authentication, admin/role permission (canManageBilling), tier gating,
 * and Open-Core `multi_tenant_saas_billing` commercial edition license.
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
    const adminGate = await enforceCommercialFeatureForUser(
      user.id,
      'multi_tenant_saas_billing',
      { resolvedTier: 'ENTERPRISE' },
    );
    if (!adminGate.ok) {
      return failure({ code: 'FEATURE_LOCKED', message: adminGate.error.message });
    }
    return success({ userId: user.id, isAdmin: true });
  }

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

  const userTier = await getUserTier(user.id);
  const subRow = await db
    .prepare('SELECT plan, status FROM subscriptions WHERE org_id = ?1 LIMIT 1')
    .bind(orgId)
    .first<{ plan: string; status: string }>();

  const eligiblePlans = ['enterprise', 'master', 'agency'];
  const orgPlan = (subRow?.plan || '').toLowerCase();
  const orgStatus = subRow?.status || '';

  const isTierEligible =
    userTier === 'ENTERPRISE' ||
    userTier === 'MASTER' ||
    (orgStatus === 'active' && eligiblePlans.includes(orgPlan));

  if (!isTierEligible) {
    return failure({
      code: 'TIER_REQUIRED',
      message: 'Enterprise E-Invoicing requires an active Enterprise or Master subscription.',
    });
  }

  const resolvedTier: Tier =
    userTier === 'MASTER' || orgPlan === 'master' ? 'MASTER' : 'ENTERPRISE';

  const gate = await enforceCommercialFeatureForUser(
    user.id,
    'multi_tenant_saas_billing',
    { resolvedTier },
  );
  if (!gate.ok) {
    return failure({ code: 'FEATURE_LOCKED', message: gate.error.message });
  }

  return success({ userId: user.id, isAdmin: false });
}
