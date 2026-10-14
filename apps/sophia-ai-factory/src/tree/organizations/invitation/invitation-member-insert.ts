/**
 * Organization Invitation Acceptor — member insertion with CAS rollback
 * Layer: tree/organizations
 */

import type { D1Database } from '@/seed/db/client';
import type { OrgInvitationLookup } from './types';

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

export async function insertMemberWithRollback(
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
