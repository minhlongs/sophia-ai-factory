/**
 * Server Actions for Organization Invitations
 *
 * Provides customer-facing mutation actions for sending, accepting, and revoking
 * invitations to multi-user organizations.
 *
 * Layer: land/admin (Can import from @/seed and @/tree; CANNOT import from @/forest)
 *
 * @module land/admin/org-invitation-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { canAssignRole } from '@/tree/rbac/permissions';
import {
  createOrgInvitation,
  acceptOrgInvitation,
  revokeOrgInvitation,
  type CreateInvitationResult,
  type AcceptInvitationResult,
} from '@/tree/organizations/invitation-service';
import {
  loadAuthenticatedInviterContext,
  type SendInvitationInput,
  type ActionError,
} from './org-invitation-helpers';

export type { SendInvitationInput, ActionError } from './org-invitation-helpers';

/**
 * Sends a cryptographic single-use invitation to an email address.
 */
export async function sendOrgInvitationAction(
  input: SendInvitationInput,
): Promise<Result<CreateInvitationResult, ActionError>> {
  try {
    const ctx = await loadAuthenticatedInviterContext(input.orgId, 'INSUFFICIENT_PERMISSIONS');
    if (!ctx.ok) return ctx;
    const { userId, db, callerRole } = ctx.value;

    if (!canAssignRole(callerRole, input.role)) {
      return failure({
        code: 'PRIVILEGE_ESCALATION',
        message: `Role '${callerRole}' cannot assign role '${input.role}'`,
      });
    }

    const invitation = await createOrgInvitation(db, {
      orgId: input.orgId,
      email: input.email,
      role: input.role,
      invitedByUserId: userId,
    });

    logger.info('[OrgInvitations] Invitation created successfully', {
      orgId: input.orgId,
      email: input.email,
      role: input.role,
      invitationId: invitation.invitationId,
    });

    return success(invitation);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[OrgInvitations] Failed to send invitation', { error: message, input });
    return failure({ code: 'INVITATION_FAILED', message });
  }
}

/**
 * Accepts an organization invitation using the provided single-use token.
 */
export async function acceptOrgInvitationAction(
  token: string,
): Promise<Result<AcceptInvitationResult, ActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to accept invitation' });
    }

    const cleanToken = token.trim();
    if (!cleanToken) {
      return failure({ code: 'INVALID_TOKEN', message: 'Invitation token is required' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database connection unavailable' });
    }

    const result = await acceptOrgInvitation(db, cleanToken, user.id);

    logger.info('[OrgInvitations] Invitation accepted successfully', {
      orgId: result.orgId,
      userId: user.id,
      role: result.role,
    });

    return success(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[OrgInvitations] Failed to accept invitation', { error: message });
    return failure({ code: 'ACCEPT_FAILED', message });
  }
}

/**
 * Revokes an existing pending invitation.
 */
export async function revokeOrgInvitationAction(
  invitationId: string,
  orgId: string,
): Promise<Result<{ revoked: boolean }, ActionError>> {
  try {
    const ctx = await loadAuthenticatedInviterContext(orgId, 'FORBIDDEN');
    if (!ctx.ok) return ctx;

    const revoked = await revokeOrgInvitation(ctx.value.db, invitationId, orgId);
    return success({ revoked });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failure({ code: 'REVOKE_FAILED', message });
  }
}
