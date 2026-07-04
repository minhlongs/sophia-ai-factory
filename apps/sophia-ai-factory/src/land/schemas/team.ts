import { z } from 'zod';

export const ORG_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;

export const inviteTeamMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(ORG_ROLES).default('member'),
});

export const updateMemberRoleSchema = z.object({
  memberUserId: z.string().min(1, 'Member user ID is required'),
  role: z.enum(ORG_ROLES, { message: 'Invalid role' }),
});

export const removeMemberSchema = z.object({
  memberUserId: z.string().min(1, 'Member user ID is required'),
});

export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
