'use server';

import { z } from 'zod';
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

export async function fetchOwnershipAction(): Promise<AccountOwnershipDetails | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return getAccountOwnershipDetails(user.id);
}

export async function toggleSupportAccessAction(orgId: string, enable: boolean) {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  try {
    return await toggleSupportAccess(user.id, orgId, enable);
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
  return inviteTeamMember(user.id, parsed.orgId, parsed.email, parsed.role);
}

export async function updateTeamMemberRoleAction(rawInput: unknown): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  const parsed = updateRoleSchema.parse(rawInput);
  return updateTeamMemberRole(user.id, parsed.orgId, parsed.memberId, parsed.role);
}

export async function removeTeamMemberAction(rawInput: unknown): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  const parsed = removeMemberSchema.parse(rawInput);
  return removeTeamMember(user.id, parsed.orgId, parsed.memberId);
}
