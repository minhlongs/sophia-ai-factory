import type { D1Database } from '@cloudflare/workers-types';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { success, failure, type Result } from '@/seed/types/result';
import {
  hasEnterprisePermission,
  isEnterpriseRole,
  type EnterpriseRole,
} from '@/seed/types/enterprise-rbac';
import type { ContractActionError } from './types';

/**
 * Asserts that the active user is authenticated and authorized to manage billing/contracts
 * for the specified organization.
 */
export async function assertContractAccess(
  db: D1Database,
  orgId: string,
): Promise<Result<{ userId: string; isAdmin: boolean }, ContractActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (isAdmin || user.role === 'admin') {
    return success({ userId: user.id, isAdmin: true });
  }

  // Check solo organization
  const isSoloOrg = orgId === `org-${user.id}`;
  if (isSoloOrg) {
    return success({ userId: user.id, isAdmin: false });
  }

  // Check organization member role
  const member = await db
    .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
    .bind(orgId, user.id)
    .first<{ role: string }>();

  if (!member) {
    return failure({
      code: 'FORBIDDEN',
      message: 'You are not a member of this enterprise organization.',
    });
  }

  const role = member.role;
  const isTraditionalAdmin = role === 'owner' || role === 'admin';
  const isEnterpriseBillingAdmin =
    role === 'enterprise_admin' ||
    (isEnterpriseRole(role) && hasEnterprisePermission(role as EnterpriseRole, 'canManageBilling'));

  if (!isTraditionalAdmin && !isEnterpriseBillingAdmin) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Your role lacks permission to manage enterprise contracts or billing.',
    });
  }

  return success({ userId: user.id, isAdmin: false });
}
