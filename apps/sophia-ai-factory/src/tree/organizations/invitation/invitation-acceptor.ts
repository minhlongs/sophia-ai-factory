/**
 * Organization Invitation Acceptor
 * Layer: tree/organizations
 */

import type { D1Database } from '@/seed/db/client';
import { sha256Hex } from '@/seed/security/invitation-token';
import { checkSeatQuota } from '../seat-quota-engine';
import type { AcceptInvitationResult } from '@/seed/types/org-invitations';
import type { OrgInvitationLookup } from './types';

async function findInvitationByTokenHash(
  db: D1Database,
  tokenHash: string,
): Promise<{ invitation: OrgInvitationLookup; targetTable: string } | null> {
  for (const table of ['org_invitations', 'organization_invitations']) {
    try {
      const row = await db
        .prepare(`SELECT id, org_id, email, role, status, expires_at FROM ${table} WHERE token_hash = ?1 LIMIT 1`)
        .bind(tokenHash)
        .first<OrgInvitationLookup>();
      if (row) {
        return { invitation: row, targetTable: table };
      }
    } catch {
      // Continue to next candidate table
    }
  }
  return null;
}

async function claimInvitationCas(
  db: D1Database,
  invitation: OrgInvitationLookup,
  targetTable: string,
  now: number,
): Promise<void> {
  if (invitation.status !== 'pending') {
    const err = new Error(`INVITATION_ALREADY_USED: Invitation has status '${invitation.status}' (TOKEN_ALREADY_USED)`) as Error & { code?: string };
    err.code = 'TOKEN_ALREADY_USED';
    throw err;
  }

  if (now > invitation.expires_at) {
    await db
      .prepare(`UPDATE ${targetTable} SET status = 'expired' WHERE id = ?1`)
      .bind(invitation.id)
      .run();
    throw new Error(`INVITATION_EXPIRED: Token expired at ${invitation.expires_at} (TOKEN_EXPIRED)`);
  }

  const quota = await checkSeatQuota(db, invitation.org_id);
  if (quota.activeMembers >= quota.maxSeats) {
    throw new Error(`SEAT_QUOTA_EXCEEDED: Organization is full (${quota.allocated}/${quota.maxSeats})`);
  }

  const updateResult = await db
    .prepare(
      `UPDATE ${targetTable}
       SET status = 'accepted', accepted_at = ?1
       WHERE id = ?2 AND status = 'pending'`
    )
    .bind(now, invitation.id)
    .run();

  const changes = updateResult.meta?.changes ?? (updateResult as { changes?: number }).changes ?? 0;
  if (changes === 0) {
    const err = new Error('INVITATION_ALREADY_USED: Invitation has already been accepted or is no longer pending (TOKEN_ALREADY_USED)') as Error & { code?: string };
    err.code = 'TOKEN_ALREADY_USED';
    throw err;
  }
}

async function rollbackCasClaim(db: D1Database, targetTable: string, invitationId: string): Promise<void> {
  try {
    await db
      .prepare(`UPDATE ${targetTable} SET status = 'pending', accepted_at = NULL WHERE id = ?1`)
      .bind(invitationId)
      .run();
  } catch {}
}

async function insertMemberToOrganizationMembers(
  db: D1Database,
  invitation: OrgInvitationLookup,
  userId: string,
  memberId: string,
  now: number,
): Promise<boolean> {
  try {
    const insertResult = await db
      .prepare(
        `INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6
         WHERE (SELECT COUNT(*) FROM organization_members WHERE org_id = ?2) < (
           SELECT COALESCE(max_seats, 5) FROM organizations WHERE id = ?2
         )`
      )
      .bind(memberId, invitation.org_id, userId, invitation.role, now, now)
      .run();

    const insertChanges = insertResult.meta?.changes ?? (insertResult as { changes?: number }).changes ?? 0;
    if (insertChanges === 0) {
      throw new Error('SEAT_QUOTA_EXCEEDED: Organization is full');
    }
    return true;
  } catch (err: unknown) {
    const errStr = err instanceof Error ? err.message : String(err);
    if (errStr.includes('SEAT_QUOTA_EXCEEDED') || errStr.toLowerCase().includes('unique')) {
      throw err;
    }
    return false;
  }
}

async function insertMemberToOrgMembers(
  db: D1Database,
  invitation: OrgInvitationLookup,
  userId: string,
  memberId: string,
  now: number,
): Promise<void> {
  const insertResult = await db
    .prepare(
      `INSERT INTO org_members (id, org_id, user_id, role, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5
       WHERE (SELECT COUNT(*) FROM org_members WHERE org_id = ?2) < (
         SELECT COALESCE(max_seats, 5) FROM organizations WHERE id = ?2
       )`
    )
    .bind(memberId, invitation.org_id, userId, invitation.role, now)
    .run();

  const insertChanges = insertResult.meta?.changes ?? (insertResult as { changes?: number }).changes ?? 0;
  if (insertChanges === 0) {
    throw new Error('SEAT_QUOTA_EXCEEDED: Organization is full');
  }
}

async function insertMemberWithRollback(
  db: D1Database,
  targetTable: string,
  invitation: OrgInvitationLookup,
  userId: string,
  now: number,
): Promise<void> {
  const memberId = `mem_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  try {
    const inserted = await insertMemberToOrganizationMembers(db, invitation, userId, memberId, now);
    if (!inserted) {
      await insertMemberToOrgMembers(db, invitation, userId, memberId, now);
    }
  } catch (err: unknown) {
    await rollbackCasClaim(db, targetTable, invitation.id);
    throw err;
  }
}

/**
 * Accepts an organization invitation, atomically consumes the token, and creates a member.
 */
export async function acceptOrgInvitation(
  db: D1Database,
  token: string,
  userId: string,
): Promise<AcceptInvitationResult> {
  const tokenHash = await sha256Hex(token.trim());
  const now = Date.now();

  const found = await findInvitationByTokenHash(db, tokenHash);
  if (!found) {
    throw new Error('INVALID_INVITATION_TOKEN: Invitation token not found (TOKEN_NOT_FOUND)');
  }

  const { invitation, targetTable } = found;

  await claimInvitationCas(db, invitation, targetTable, now);
  await insertMemberWithRollback(db, targetTable, invitation, userId, now);

  return {
    success: true,
    orgId: invitation.org_id,
    role: invitation.role,
  };
}
