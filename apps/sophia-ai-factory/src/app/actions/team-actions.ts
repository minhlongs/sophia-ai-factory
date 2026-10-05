'use server';

/**
 * Server Action: team-actions
 *
 * Thin controller for team member operations.
 * Delegates data operations and authorization to Land team manager service.
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { revalidatePath } from 'next/cache';
import { inviteTeamMemberSchema, updateMemberRoleSchema, removeMemberSchema } from '@/land/schemas/team';
import {
  getTeamMembersForUser,
  inviteTeamMemberByEmail,
  removeTeamMemberFromOrg,
  updateTeamMemberRoleInOrg,
} from '@/land/teams';
import type { TeamActionResult, TeamMemberEntry } from '@/land/teams';

export type { TeamActionResult, TeamMemberEntry };

/**
 * List all members of the current user's organization.
 */
export async function listTeamMembers(): Promise<TeamMemberEntry[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  return getTeamMembersForUser(user.id);
}

/**
 * Invite a new member to the org (admin/owner only).
 */
export async function inviteTeamMember(
  formData: FormData,
): Promise<TeamActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const raw = {
    email: formData.get('email') as string,
    role: formData.get('role') as string,
  };

  const parsed = inviteTeamMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((e) => e.message).join(', ') };
  }

  const res = await inviteTeamMemberByEmail(user.id, parsed.data.email, parsed.data.role);
  if (res.success) {
    revalidatePath('/dashboard/settings/team');
  }
  return res;
}

/**
 * Remove a member from the org (admin/owner only).
 */
export async function removeTeamMemberAction(
  formData: FormData,
): Promise<TeamActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const parsed = removeMemberSchema.safeParse({
    memberUserId: formData.get('memberUserId') as string,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((e) => e.message).join(', ') };
  }

  const res = await removeTeamMemberFromOrg(user.id, parsed.data.memberUserId);
  if (res.success) {
    revalidatePath('/dashboard/settings/team');
  }
  return res;
}

/**
 * Update a member's role (admin/owner only).
 */
export async function updateMemberRoleAction(
  formData: FormData,
): Promise<TeamActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const parsed = updateMemberRoleSchema.safeParse({
    memberUserId: formData.get('memberUserId') as string,
    role: formData.get('role') as string,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((e) => e.message).join(', ') };
  }

  const res = await updateTeamMemberRoleInOrg(user.id, parsed.data.memberUserId, parsed.data.role);
  if (res.success) {
    revalidatePath('/dashboard/settings/team');
  }
  return res;
}
