import type { D1Database } from '@cloudflare/workers-types';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getUserTier } from '@/seed/db/get-user-tier';
import { success, failure, type Result } from '@/seed/types/result';
import type { CustomDomainError } from '@/seed/types/custom-domains';

export async function assertMasterTierAndOrgAccess(
  db: D1Database,
  orgId: string,
): Promise<Result<{ userId: string; isAdmin: boolean }, CustomDomainError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  const { isAdmin } = await isUserAdminWithRole(user);

  // Platform admins bypass org check and tier requirements
  if (isAdmin || user.role === 'admin') {
    return success({ userId: user.id, isAdmin: true });
  }

  // 1. Verify user is a member of the organization with owner or admin role (or solo org)
  const isSoloOrg = orgId === `org-${user.id}`;
  const member = await db
    .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
    .bind(orgId, user.id)
    .first<{ role: string }>();

  if (!isSoloOrg && (!member || (member.role !== 'owner' && member.role !== 'admin'))) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Only organization owners or admins can manage custom domains',
    });
  }

  // 2. Enforce MASTER or ENTERPRISE tier requirement
  const tier = await getUserTier(user.id);
  const orgSub = await db
    .prepare("SELECT tier, plan FROM subscriptions WHERE org_id = ?1 AND status = 'active' LIMIT 1")
    .bind(orgId)
    .first<{ tier: string | null; plan: string | null }>();

  const isMasterOrEnterprise =
    tier === 'MASTER' ||
    tier === 'ENTERPRISE' ||
    orgSub?.tier === 'MASTER' ||
    orgSub?.tier === 'ENTERPRISE' ||
    orgSub?.plan?.toLowerCase() === 'master' ||
    orgSub?.plan?.toLowerCase() === 'enterprise';

  if (!isMasterOrEnterprise) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Custom domains require a MASTER or ENTERPRISE tier subscription',
    });
  }

  return success({ userId: user.id, isAdmin: false });
}
