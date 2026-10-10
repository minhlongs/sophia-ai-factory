'use server';

/**
 * seat-manager.ts — Land Layer
 * Member invitations and removal for organizations
 */

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { requireMaster } from './role-guard';

/**
 * Invite a user to an organization by email.
 * Looks up user by email; returns NOT_FOUND if user does not exist.
 */
export async function inviteMember(
  orgId: string,
  email: string,
  role: string,
): Promise<Result<{ success: boolean }, { code: string; message: string }>> {
  try {
    const auth = await requireMaster();
    if (!auth.ok) return auth;

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      return failure({ code: 'VALIDATION', message: 'Email is required' });
    }

    const validRoles = ['owner', 'admin', 'member'];
    if (!validRoles.includes(role)) {
      return failure({ code: 'VALIDATION', message: `Role must be one of: ${validRoles.join(', ')}` });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database not available' });
    }

    const userRow = await db
      .prepare('SELECT id FROM users WHERE email = ?1 LIMIT 1')
      .bind(trimmedEmail)
      .first<{ id: string }>();

    if (!userRow) {
      return failure({ code: 'USER_NOT_FOUND', message: 'No user found with that email address' });
    }

    const existing = await db
      .prepare('SELECT id FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
      .bind(orgId, userRow.id)
      .first<{ id: string }>();

    if (existing) {
      return failure({ code: 'ALREADY_MEMBER', message: 'User is already a member of this organization' });
    }

    await db
      .prepare('INSERT INTO org_members (org_id, user_id, role) VALUES (?1, ?2, ?3)')
      .bind(orgId, userRow.id, role)
      .run();

    logger.info('[OrgManager] Invited member', { orgId, email: trimmedEmail, role, userId: userRow.id });
    return success({ success: true });
  } catch (err) {
    const error = toError(err);
    logger.error('[OrgManager] inviteMember failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}

/**
 * Remove a member from an organization.
 * Cannot remove the last owner.
 */
export async function removeMember(
  orgId: string,
  userId: string,
): Promise<Result<{ success: boolean }, { code: string; message: string }>> {
  try {
    const auth = await requireMaster();
    if (!auth.ok) return auth;

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database not available' });
    }

    const member = await db
      .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
      .bind(orgId, userId)
      .first<{ role: string }>();

    if (!member) {
      return failure({ code: 'NOT_FOUND', message: 'Member not found' });
    }

    if (member.role === 'owner') {
      const { results: owners } = await db
        .prepare('SELECT user_id FROM org_members WHERE org_id = ?1 AND role = \'owner\'')
        .bind(orgId)
        .all<{ user_id: string }>();

      if (owners.length <= 1) {
        return failure({ code: 'LAST_OWNER', message: 'Cannot remove the last owner of the organization' });
      }
    }

    await db
      .prepare('DELETE FROM org_members WHERE org_id = ?1 AND user_id = ?2')
      .bind(orgId, userId)
      .run();

    logger.info('[OrgManager] Removed member', { orgId, userId });
    return success({ success: true });
  } catch (err) {
    const error = toError(err);
    logger.error('[OrgManager] removeMember failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}
