/**
 * Organization Invitation Creator Validation & D1 Insert Helpers
 * Layer: tree/organizations
 */

import type { D1Database } from '@/seed/db/client';
import type { OrgRole } from '@/seed/types/rbac-matrix';
import type { CreateInvitationInput } from '@/seed/types/org-invitations';
import type { NormalizedInvitationParams, InsertInvitationParams } from './types';

export function normalizeInvitationParams(
  orgIdOrInput: string | CreateInvitationInput,
  emailArg?: string,
  roleArg?: OrgRole,
  invitedByUserIdArg?: string,
  appBaseUrlArg?: string,
): NormalizedInvitationParams {
  const isObject = typeof orgIdOrInput === 'object';
  const orgId = isObject ? orgIdOrInput.orgId : orgIdOrInput;
  const rawEmail = isObject ? orgIdOrInput.email : (emailArg ?? '');
  const role: OrgRole = isObject ? orgIdOrInput.role : (roleArg ?? 'viewer');
  const invitedByUserId = isObject ? orgIdOrInput.invitedByUserId : (invitedByUserIdArg ?? 'system');
  const appBaseUrl = isObject ? orgIdOrInput.appBaseUrl : appBaseUrlArg;

  const email = rawEmail.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('VALIDATION_ERROR: A valid email address is required');
  }

  return { orgId, email, role, invitedByUserId, appBaseUrl };
}

export async function tryInsertOrgInvitations(
  db: D1Database,
  memTable: 'organization_members' | 'org_members',
  params: InsertInvitationParams,
): Promise<boolean> {
  try {
    const res = await db
      .prepare(
        `INSERT INTO org_invitations
         (id, org_id, email, role, token_hash, expires_at, created_by, created_at, status)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending'
         WHERE (
          (SELECT COUNT(*) FROM ${memTable} WHERE org_id = ?2) +
           (SELECT COUNT(*) FROM org_invitations WHERE org_id = ?2 AND status = 'pending' AND expires_at > ?8)
         ) < ?9`
      )
      .bind(
        params.invitationId,
        params.orgId,
        params.email,
        params.role,
        params.tokenHash,
        params.expiresAt,
        params.invitedByUserId,
        params.now,
        params.maxSeats,
      )
      .run();

    const changes = res.meta?.changes ?? (res as { changes?: number }).changes ?? 0;
    if (changes === 0) {
      throw new Error(`SEAT_QUOTA_EXCEEDED: Org has reached seat limit (${params.allocated}/${params.maxSeats})`);
    }
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('SEAT_QUOTA_EXCEEDED') || msg.toLowerCase().includes('unique')) {
      throw err;
    }
    return false;
  }
}

export async function tryInsertOrganizationInvitations(
  db: D1Database,
  memTable: 'organization_members' | 'org_members',
  params: InsertInvitationParams,
): Promise<boolean> {
  try {
    const res = await db
      .prepare(
        `INSERT INTO organization_invitations
         (id, org_id, email, role, token_hash, invited_by, expires_at, status, created_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8
         WHERE (
           (SELECT COUNT(*) FROM ${memTable} WHERE org_id = ?2) +
           (SELECT COUNT(*) FROM organization_invitations WHERE org_id = ?2 AND status = 'pending' AND expires_at > ?8)
         ) < ?9`
      )
      .bind(
        params.invitationId,
        params.orgId,
        params.email,
        params.role,
        params.tokenHash,
        params.invitedByUserId,
        params.expiresAt,
        params.now,
        params.maxSeats,
      )
      .run();

    const changes = res.meta?.changes ?? (res as { changes?: number }).changes ?? 0;
    if (changes === 0) {
      throw new Error(`SEAT_QUOTA_EXCEEDED: Org has reached seat limit (${params.allocated}/${params.maxSeats})`);
    }
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('SEAT_QUOTA_EXCEEDED') || msg.toLowerCase().includes('unique')) {
      throw err;
    }
    return false;
  }
}

export async function insertInvitationWithFallback(
  db: D1Database,
  params: InsertInvitationParams,
): Promise<void> {
  if (await tryInsertOrgInvitations(db, 'organization_members', params)) return;
  if (await tryInsertOrganizationInvitations(db, 'organization_members', params)) return;
  if (await tryInsertOrgInvitations(db, 'org_members', params)) return;
  await tryInsertOrganizationInvitations(db, 'org_members', params);
}
