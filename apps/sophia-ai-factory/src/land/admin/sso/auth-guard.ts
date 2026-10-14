import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getUserTier } from '@/seed/db/get-user-tier';
import { success, failure, type Result } from '@/seed/types/result';
import type { SsoActionError } from '@/seed/types/enterprise-sso';
import type { D1Database } from '@cloudflare/workers-types';

export interface SsoAuthContext {
  userId: string;
  userEmail: string;
  isAdmin: boolean;
}

export async function assertEnterpriseSsoAccess(
  db: D1Database,
  orgId: string,
): Promise<Result<SsoAuthContext, SsoActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (isAdmin || user.role === 'admin') {
    return success({ userId: user.id, userEmail: user.email, isAdmin: true });
  }

  // Check org membership
  const isSoloOrg = orgId === `org-${user.id}`;
  const member = await db
    .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
    .bind(orgId, user.id)
    .first<{ role: string }>();

  const isOwnerOrAdmin =
    isSoloOrg ||
    (member && (member.role === 'owner' || member.role === 'admin' || member.role === 'enterprise_admin'));

  if (!isOwnerOrAdmin) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Only organization administrators can manage Enterprise SSO configurations',
    });
  }

  // Tier check: ENTERPRISE or MASTER tier required
  const tier = await getUserTier(user.id);
  const orgSub = await db
    .prepare("SELECT tier, plan FROM subscriptions WHERE org_id = ?1 AND status = 'active' LIMIT 1")
    .bind(orgId)
    .first<{ tier: string | null; plan: string | null }>();

  const isEnterpriseTier =
    tier === 'ENTERPRISE' ||
    tier === 'MASTER' ||
    orgSub?.tier === 'ENTERPRISE' ||
    orgSub?.tier === 'MASTER' ||
    orgSub?.plan?.toLowerCase() === 'enterprise' ||
    orgSub?.plan?.toLowerCase() === 'master';

  if (!isEnterpriseTier) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Enterprise SSO requires an ENTERPRISE or MASTER subscription tier.',
    });
  }

  return success({ userId: user.id, userEmail: user.email, isAdmin: false });
}
