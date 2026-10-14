/**
 * Webhook Admin Access Verifier
 *
 * Layer: land/admin/webhooks
 */

import type { D1Database } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import type { OrgRole } from '@/seed/types/rbac-matrix';
import { canConfigureWebhooks } from '@/tree/rbac/permissions';
import type { ActionError } from './types';

/**
 * Verifies authorization and returns user's org role.
 */
export async function verifyWebhookAccess(
  db: D1Database,
  orgId: string,
): Promise<Result<{ userId: string; role: OrgRole }, ActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  // System admin override
  if ((user as { role?: string }).role === 'admin') {
    return success({ userId: user.id, role: 'owner' });
  }

  const member = await db
    .prepare(
      `SELECT role FROM organization_members WHERE org_id = ?1 AND user_id = ?2
       UNION
       SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2
       LIMIT 1`
    )
    .bind(orgId, user.id)
    .first<{ role: string }>();

  if (!member) {
    return failure({ code: 'FORBIDDEN', message: 'You are not a member of this organization' });
  }

  const role = member.role as OrgRole;
  if (!canConfigureWebhooks(role)) {
    return failure({
      code: 'INSUFFICIENT_PERMISSIONS',
      message: `Role '${role}' lacks permission 'canConfigureWebhooks'`,
    });
  }

  return success({ userId: user.id, role });
}
