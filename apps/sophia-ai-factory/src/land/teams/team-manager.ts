/**
 * Team Manager — Land Domain Service
 *
 * Encapsulates team membership, invitations, role management, and member queries.
 *
 * @module land/teams/team-manager
 */

import { createServerClient } from '@/seed/db/client';
import {
  requireOrgMembership,
  requireManagerRole,
  addOrgMember,
  removeOrgMember,
  updateOrgMemberRole,
  getOrgMembersWithDetails,
} from '@/seed/db/org-membership';
import type { OrgRole, OrgMemberWithDetails } from '@/seed/db/org-membership';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export type TeamActionResult =
  | { success: true }
  | { success: false; error: string };

export type TeamMemberEntry = OrgMemberWithDetails;

/**
 * List all members of the given user's organization with details (batch query).
 */
export async function getTeamMembersForUser(userId: string): Promise<TeamMemberEntry[]> {
  const membership = await requireOrgMembership(userId);
  if (!membership.authorized) {
    throw new Error(membership.error);
  }

  return getOrgMembersWithDetails(membership.orgId);
}

/**
 * Invite a member to the organization by email.
 */
export async function inviteTeamMemberByEmail(
  inviterUserId: string,
  email: string,
  role: OrgRole,
): Promise<TeamActionResult> {
  const managerCheck = await requireManagerRole(inviterUserId);
  if (!managerCheck.authorized) {
    return { success: false, error: managerCheck.error };
  }

  try {
    const db = createServerClient();
    const { data: targetUser } = await db
      .from('user')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (!targetUser) {
      return { success: false, error: 'No user found with that email address' };
    }

    const targetUserId = (targetUser as Record<string, string>).id;
    const err = await addOrgMember(managerCheck.orgId, targetUserId, role);
    if (err) {
      return { success: false, error: err };
    }

    logger.info(`Team member invited: userId=${targetUserId}, orgId=${managerCheck.orgId}, role=${role} by userId=${inviterUserId}`);
    return { success: true };
  } catch (e) {
    const msg = toError(e).message;
    logger.error('Failed to invite team member', toError(e));
    return { success: false, error: msg };
  }
}

/**
 * Remove a member from the organization.
 */
export async function removeTeamMemberFromOrg(
  actorUserId: string,
  targetMemberUserId: string,
): Promise<TeamActionResult> {
  const managerCheck = await requireManagerRole(actorUserId);
  if (!managerCheck.authorized) {
    return { success: false, error: managerCheck.error };
  }

  try {
    const err = await removeOrgMember(managerCheck.orgId, targetMemberUserId);
    if (err) return { success: false, error: err };

    logger.info(`Team member removed: userId=${targetMemberUserId} by userId=${actorUserId}`);
    return { success: true };
  } catch (e) {
    logger.error('Failed to remove team member', toError(e));
    return { success: false, error: toError(e).message };
  }
}

/**
 * Update a member's role in the organization.
 */
export async function updateTeamMemberRoleInOrg(
  actorUserId: string,
  targetMemberUserId: string,
  role: OrgRole,
): Promise<TeamActionResult> {
  const managerCheck = await requireManagerRole(actorUserId);
  if (!managerCheck.authorized) {
    return { success: false, error: managerCheck.error };
  }

  try {
    const err = await updateOrgMemberRole(managerCheck.orgId, targetMemberUserId, role);
    if (err) return { success: false, error: err };

    logger.info(`Team member role updated: userId=${targetMemberUserId}, role=${role} by userId=${actorUserId}`);
    return { success: true };
  } catch (e) {
    logger.error('Failed to update member role', toError(e));
    return { success: false, error: toError(e).message };
  }
}
