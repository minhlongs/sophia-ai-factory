/**
 * Authorization Guard Helpers for Cryptographic Audit Vault Administration
 *
 * Layer: land (Public business layer)
 * @module land/admin/enterprise-audit-auth
 */

import type { D1Database } from '@cloudflare/workers-types';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { success, failure, type Result } from '@/seed/types/result';
import { hasEnterprisePermission, type EnterpriseRole } from '@/seed/types/enterprise-rbac';

export interface AuditActionError {
  code: string;
  message: string;
}

export async function assertAuditVaultAccess(
  db: D1Database,
  orgId?: string,
): Promise<Result<{ userId: string; userEmail: string; isAdmin: boolean }, AuditActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (isAdmin || user.role === 'admin') {
    return success({ userId: user.id, userEmail: user.email, isAdmin: true });
  }

  if (!orgId) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Global audit vault inspection requires platform administrator privileges.',
    });
  }

  const member = await db
    .prepare(
      `SELECT role, enterprise_role
       FROM organization_members
       WHERE org_id = ? AND user_id = ? AND status = 'active'
       LIMIT 1`,
    )
    .bind(orgId, user.id)
    .first<{ role: string; enterprise_role: EnterpriseRole | null }>();

  if (!member) {
    return failure({ code: 'FORBIDDEN', message: 'Not a member of this organization.' });
  }

  const isLegacyAllowed = member.role === 'owner' || member.role === 'admin';
  const isEnterpriseAllowed = member.enterprise_role
    ? hasEnterprisePermission(member.enterprise_role, 'canViewAuditVault')
    : false;

  if (!isLegacyAllowed && !isEnterpriseAllowed) {
    return failure({
      code: 'FORBIDDEN',
      message:
        'Enterprise Admin or Creative Director role required to inspect cryptographic audit trails.',
    });
  }

  return success({ userId: user.id, userEmail: user.email, isAdmin: false });
}
