/**
 * Shared D1 and RBAC membership lookup helper for Organization Invitation Actions.
 * @module land/admin/org-invitation-helpers
 */

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import type { OrgRole } from '@/seed/types/rbac-matrix';
import { canInviteMembers } from '@/tree/rbac/permissions';

export interface SendInvitationInput {
  orgId: string;
  email: string;
  role: OrgRole;
}

export interface ActionError {
  code: string;
  message: string;
}

export async function loadAuthenticatedInviterContext(
  orgId: string,
  notPermittedCode: 'INSUFFICIENT_PERMISSIONS' | 'FORBIDDEN',
): Promise<
  Result<
    {
      userId: string;
      db: NonNullable<Awaited<ReturnType<typeof getD1>>>;
      callerRole: OrgRole;
    },
    ActionError
  >
> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  const db = await getD1();
  if (!db) {
    return failure({ code: 'DB_UNAVAILABLE', message: 'Database connection unavailable' });
  }

  const callerMember = await db
    .prepare(
      `SELECT role FROM organization_members WHERE org_id = ?1 AND user_id = ?2
       UNION
       SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2
       LIMIT 1`,
    )
    .bind(orgId, user.id)
    .first<{ role: string }>();

  if (!callerMember) {
    return failure({
      code: 'FORBIDDEN',
      message:
        notPermittedCode === 'FORBIDDEN'
          ? 'You do not have permission to revoke invitations for this organization'
          : 'You are not a member of this organization',
    });
  }

  const callerRole = callerMember.role as OrgRole;
  if (!canInviteMembers(callerRole)) {
    return failure({
      code: notPermittedCode,
      message:
        notPermittedCode === 'FORBIDDEN'
          ? 'You do not have permission to revoke invitations for this organization'
          : `Role '${callerRole}' is not permitted to invite members`,
    });
  }

  return success({ userId: user.id, db, callerRole });
}
