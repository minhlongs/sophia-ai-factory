'use server';

import { z } from 'zod';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
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

const inviteSchema = z.object({
  orgId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['EDITOR', 'VIEWER']),
});

const updateRoleSchema = z.object({
  orgId: z.string().min(1),
  memberId: z.string().min(1),
  role: z.enum(['EDITOR', 'VIEWER']),
});

const removeMemberSchema = z.object({
  orgId: z.string().min(1),
  memberId: z.string().min(1),
});

const updateProfileSchema = z.object({
  name: z
    .string()
    .transform((val) => val.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim())
    .refine((val) => val.length >= 1, {
      message: 'Name cannot be empty',
    })
    .refine((val) => val.length <= 100, {
      message: 'Name cannot exceed 100 characters',
    })
    .refine((val) => !/<[^>]*>|[<>]/.test(val), {
      message: 'Name cannot contain HTML or script characters',
    }),
});

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

export interface UpdateProfileResult {
  success: boolean;
  error?: string;
}

export async function updateUserProfileAction(
  input: { name: string } | unknown
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

  try {
    const d1 = await getD1();
    if (!d1) {
      return { success: false, error: 'Database unavailable' };
    }

    // 1. Update Better Auth "user" table
    await d1
      .prepare('UPDATE "user" SET name = ?, updatedAt = datetime(\'now\') WHERE id = ?')
      .bind(parsedName, user.id)
      .run();

    // 2. Best-effort update legacy users table
    try {
      await d1
        .prepare('UPDATE users SET full_name = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .bind(parsedName, user.id)
        .run();
    } catch {
      // Ignore if legacy users record absent
    }

    revalidatePath('/settings');
    revalidatePath('/[locale]/settings');
    revalidatePath('/dashboard');
    revalidatePath('/[locale]/dashboard');
    revalidateTag('user_profile', 'max');

    return { success: true };
  } catch (err) {
    logger.error('[AccountActions] updateUserProfileAction failed', err instanceof Error ? err : new Error(String(err)));
    return { success: false, error: 'Failed to update profile' };
  }
}

