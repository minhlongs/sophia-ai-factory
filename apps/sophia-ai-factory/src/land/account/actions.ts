'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  getAccountOwnershipDetails,
  toggleSupportAccess,
  listTeamMembers,
  inviteTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  type AccountOwnershipDetails,
  type TeamMember,
} from './ownership-management';
import {
  inviteSchema,
  updateRoleSchema,
  removeMemberSchema,
  updateProfileSchema,
  persistUserProfileName,
  type UpdateProfileResult,
} from './actions-schemas';

export type { UpdateProfileResult };

export async function fetchOwnershipAction(): Promise<AccountOwnershipDetails | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return getAccountOwnershipDetails(user.id);
}

export async function toggleSupportAccessAction(orgId: string, enable: boolean) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  try {
    const result = await toggleSupportAccess(user.id, orgId, enable);
    revalidatePath('/settings');
    revalidatePath('/[locale]/settings');
    revalidateTag('account_settings', 'max');
    return result;
  } catch (err) {
    logger.warn('[AccountActions] Failed to toggle support access', { error: toError(err).message });
    throw new Error('Failed to update support access');
  }
}

export async function listTeamMembersAction(orgId: string): Promise<TeamMember[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return listTeamMembers(user.id, orgId);
}

export async function inviteTeamMemberAction(rawInput: unknown): Promise<TeamMember> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  const parsed = inviteSchema.parse(rawInput);
  const result = await inviteTeamMember(user.id, parsed.orgId, parsed.email, parsed.role);
  revalidatePath('/settings');
  revalidatePath('/[locale]/settings');
  revalidateTag('team_members', 'max');
  return result;
}

export async function updateTeamMemberRoleAction(rawInput: unknown): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  const parsed = updateRoleSchema.parse(rawInput);
  const result = await updateTeamMemberRole(user.id, parsed.orgId, parsed.memberId, parsed.role);
  revalidatePath('/settings');
  revalidatePath('/[locale]/settings');
  revalidateTag('team_members', 'max');
  return result;
}

export async function removeTeamMemberAction(rawInput: unknown): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  const parsed = removeMemberSchema.parse(rawInput);
  const result = await removeTeamMember(user.id, parsed.orgId, parsed.memberId);
  revalidatePath('/settings');
  revalidatePath('/[locale]/settings');
  revalidateTag('team_members', 'max');
  return result;
}

export async function updateUserProfileAction(
  input: { name: string } | unknown,
): Promise<UpdateProfileResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  let parsedName: string;
  try {
    if (!input || typeof input !== 'object') {
      return { success: false, error: 'Invalid input: expected object' };
    }

    const parseResult = updateProfileSchema.safeParse(input);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      return {
        success: false,
        error: firstIssue?.message || 'Invalid input',
      };
    }
    parsedName = parseResult.data.name;
  } catch {
    return { success: false, error: 'Invalid input' };
  }

  const res = await persistUserProfileName(user.id, parsedName);
  if (res.success) {
    revalidatePath('/settings');
    revalidatePath('/[locale]/settings');
    revalidatePath('/dashboard');
    revalidatePath('/[locale]/dashboard');
    revalidateTag('user_profile', 'max');
  }
  return res;
}
