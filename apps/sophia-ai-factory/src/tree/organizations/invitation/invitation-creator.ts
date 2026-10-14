/**
 * Organization Invitation Creator
 * Layer: tree/organizations
 */

import type { D1Database } from '@/seed/db/client';
import { generateInvitationToken, INVITATION_TTL_MS } from '@/seed/security/invitation-token';
import { checkSeatQuota } from '../seat-quota-engine';
import type { OrgRole } from '@/seed/types/rbac-matrix';
import type {
  CreateInvitationInput,
  CreateInvitationResult,
} from '@/seed/types/org-invitations';
import {
  insertInvitationWithFallback,
  normalizeInvitationParams,
  tryInsertOrgInvitations,
  tryInsertOrganizationInvitations,
} from './invitation-creator-helpers';

export {
  insertInvitationWithFallback,
  normalizeInvitationParams,
  tryInsertOrgInvitations,
  tryInsertOrganizationInvitations,
};

/**
 * Creates a new organization invitation with a cryptographic 256-bit single-use token.
 */
export async function createOrgInvitation(
  db: D1Database,
  orgIdOrInput: string | CreateInvitationInput,
  emailArg?: string,
  roleArg?: OrgRole,
  invitedByUserIdArg?: string,
  appBaseUrlArg?: string,
): Promise<CreateInvitationResult> {
  const { orgId, email, role, invitedByUserId, appBaseUrl } = normalizeInvitationParams(
    orgIdOrInput,
    emailArg,
    roleArg,
    invitedByUserIdArg,
    appBaseUrlArg,
  );

  const quota = await checkSeatQuota(db, orgId);
  if (!quota.isAllowed) {
    throw new Error(`SEAT_QUOTA_EXCEEDED: Org has reached seat limit (${quota.allocated}/${quota.maxSeats})`);
  }

  const { rawToken, tokenHash, expiresAt } = await generateInvitationToken(INVITATION_TTL_MS);
  const now = Date.now();
  const invitationId = `inv_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  await insertInvitationWithFallback(db, {
    invitationId,
    orgId,
    email,
    role,
    tokenHash,
    expiresAt,
    invitedByUserId,
    now,
    maxSeats: quota.maxSeats,
    allocated: quota.allocated,
  });

  const baseUrl = appBaseUrl || 'https://sophia.agencyos.network';
  const inviteUrl = `${baseUrl}/invitations/accept?token=${rawToken}`;

  return {
    invitationId,
    inviteUrl,
    token: rawToken,
    expiresAt,
  };
}
