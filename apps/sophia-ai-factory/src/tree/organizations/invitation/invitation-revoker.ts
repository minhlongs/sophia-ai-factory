/**
 * Organization Invitation Revoker
 * Layer: tree/organizations
 */

import type { D1Database } from '@/seed/db/client';

/**
 * Revokes a pending organization invitation.
 */
export async function revokeOrgInvitation(
  db: D1Database,
  invitationId: string,
  orgId: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE org_invitations
       SET status = 'revoked'
       WHERE id = ?1 AND org_id = ?2 AND status = 'pending'`
    )
    .bind(invitationId, orgId)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}
