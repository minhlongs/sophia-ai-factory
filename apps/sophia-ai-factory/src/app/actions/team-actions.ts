'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { revalidatePath } from 'next/cache';
import { requireOrgMembership, requireManagerRole, getOrgMembers, addOrgMember, removeOrgMember, updateOrgMemberRole } from '@/seed/db/org-membership';
import { inviteTeamMemberSchema, updateMemberRoleSchema, removeMemberSchema } from '@/land/schemas/team';
import type { OrgMemberRow } from '@/seed/db/org-membership';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export type TeamActionResult =
  | { success: true }
  | { success: false; error: string };

export type TeamMemberEntry = OrgMemberRow & {
  email: string;
  name: string;
};

/**
 * List all members of the current user's organization.
 */
export async function listTeamMembers(): Promise<TeamMemberEntry[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const membership = await requireOrgMembership(user.id);
  if (!membership.authorized) throw new Error(membership.error);

  const members = await getOrgMembers(membership.orgId);

  // Enrich with user details from the `user` table
  const enriched: TeamMemberEntry[] = [];
  for (const member of members) {
    let email = '';
    let name = '';
    try {
      const db = createServerClient();
      const { data: userData } = await db
        .from('user')
        .select('email, name')
        .eq('id', member.userId)
        .maybeSingle();

      if (userData) {
        const row = userData as Record<string, string>;
        email = row.email ?? '';
        name = row.name ?? '';
      }
    } catch {
      // non-fatal — return member without enrichment
    }
    enriched.push({ ...member, email, name });
  }

  return enriched;
}

/**
 * Invite a new member to the org (admin/owner only).
 * The invited user must already have a platform account.
 */
export async function inviteTeamMember(
  formData: FormData,
): Promise<TeamActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const managerCheck = await requireManagerRole(user.id);
  if (!managerCheck.authorized) {
    return { success: false, error: managerCheck.error };
  }

  const raw = {
    email: formData.get('email') as string,
    role: formData.get('role') as string,
  };

  const parsed = inviteTeamMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((e) => e.message).join(', ') };
  }

  const { email, role } = parsed.data;

  try {
    const db = createServerClient();

    // Find user by email
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

    revalidatePath('/dashboard/settings/team');
    logger.info(`Team member invited: userId=${targetUserId}, orgId=${managerCheck.orgId}, role=${role} by userId=${user.id}`);
    return { success: true };
  } catch (e) {
    const msg = toError(e).message;
    logger.error('Failed to invite team member', toError(e));
    return { success: false, error: msg };
  }
}

/**
 * Remove a member from the org (admin/owner only).
 */
export async function removeTeamMemberAction(
  formData: FormData,
): Promise<TeamActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const managerCheck = await requireManagerRole(user.id);
  if (!managerCheck.authorized) {
    return { success: false, error: managerCheck.error };
  }

  const parsed = removeMemberSchema.safeParse({
    memberUserId: formData.get('memberUserId') as string,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((e) => e.message).join(', ') };
  }

  try {
    const err = await removeOrgMember(managerCheck.orgId, parsed.data.memberUserId);
    if (err) return { success: false, error: err };

    revalidatePath('/dashboard/settings/team');
    logger.info(`Team member removed: userId=${parsed.data.memberUserId} by userId=${user.id}`);
    return { success: true };
  } catch (e) {
    logger.error('Failed to remove team member', toError(e));
    return { success: false, error: toError(e).message };
  }
}

/**
 * Update a member's role (admin/owner only).
 */
export async function updateMemberRoleAction(
  formData: FormData,
): Promise<TeamActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const managerCheck = await requireManagerRole(user.id);
  if (!managerCheck.authorized) {
    return { success: false, error: managerCheck.error };
  }

  const parsed = updateMemberRoleSchema.safeParse({
    memberUserId: formData.get('memberUserId') as string,
    role: formData.get('role') as string,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((e) => e.message).join(', ') };
  }

  try {
    const err = await updateOrgMemberRole(managerCheck.orgId, parsed.data.memberUserId, parsed.data.role);
    if (err) return { success: false, error: err };

    revalidatePath('/dashboard/settings/team');
    logger.info(`Team member role updated: userId=${parsed.data.memberUserId}, role=${parsed.data.role} by userId=${user.id}`);
    return { success: true };
  } catch (e) {
    logger.error('Failed to update member role', toError(e));
    return { success: false, error: toError(e).message };
  }
}
