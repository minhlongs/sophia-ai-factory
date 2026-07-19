/**
 * Server Actions for organization management (MASTER-tier only).
 *
 * Uses D1 raw SQL queries. All functions return Result<T, E> for explicit
 * error discrimination — no thrown exceptions across action boundaries.
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

// ── Types ──────────────────────────────────────────────────────────────

export interface OrgRow {
  id: string;
  name: string;
  memberCount: number;
}

export interface OrgWithMeta extends OrgRow {
  description: string | null;
  createdAt: string;
}

export interface MemberRow {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
}

export interface OrgDetail extends OrgRow {
  description: string | null;
  createdAt: string;
  members: MemberRow[];
}

// ── Authorization helper ───────────────────────────────────────────────

async function requireMaster(): Promise<
  Result<{ userId: string }, { code: string; message: string }>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const db = getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database not available' });
    }

    // Note: requireMasterTier can't be used here because it redirects via throw,
    // which is incompatible with Result-based error handling. We check tier manually.
    const tierRow = await db
      .prepare('SELECT tier FROM subscriptions WHERE user_id = ?1 AND status = \'active\' LIMIT 1')
      .bind(user.id)
      .first<{ tier: string }>();

    if (!tierRow || tierRow.tier !== 'MASTER') {
      return failure({ code: 'FORBIDDEN', message: 'MASTER tier required' });
    }

    return success({ userId: user.id });
  } catch (err) {
    const error = toError(err);
    logger.error('[OrgManager] requireMaster failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}

// ── Server Actions ─────────────────────────────────────────────────────

/**
 * List all organizations with member counts.
 */
export async function listOrgs(): Promise<
  Result<OrgRow[], { code: string; message: string }>
> {
  try {
    const auth = await requireMaster();
    if (!auth.ok) return auth;

    const db = getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database not available' });
    }

    const { results } = await db
      .prepare(
        `SELECT
           o.id,
           o.name,
           (SELECT COUNT(*) FROM org_members WHERE org_id = o.id) AS member_count
         FROM organizations o
         ORDER BY o.created_at DESC`,
      )
      .all<{ id: string; name: string; member_count: number }>();

    return success(
      results.map((r) => ({
        id: r.id,
        name: r.name,
        memberCount: r.member_count,
      })),
    );
  } catch (err) {
    const error = toError(err);
    logger.error('[OrgManager] listOrgs failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}

/**
 * Get full org details including members.
 */
export async function getOrgDetail(
  orgId: string,
): Promise<Result<OrgDetail, { code: string; message: string }>> {
  try {
    const auth = await requireMaster();
    if (!auth.ok) return auth;

    const db = getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database not available' });
    }

    const orgRow = await db
      .prepare('SELECT id, name, settings, created_at FROM organizations WHERE id = ?1 LIMIT 1')
      .bind(orgId)
      .first<{ id: string; name: string; settings: string | null; created_at: string }>();

    if (!orgRow) {
      return failure({ code: 'NOT_FOUND', message: 'Organization not found' });
    }

    let description: string | null = null;
    try {
      if (orgRow.settings) {
        const parsed = JSON.parse(orgRow.settings) as Record<string, unknown>;
        description = typeof parsed.description === 'string' ? parsed.description : null;
      }
    } catch {
      // settings stored as JSON string; if parse fails, description stays null
    }

    const { results: memberRows } = await db
      .prepare(
        `SELECT
           om.user_id,
           u.email,
           u.full_name,
           om.role
         FROM org_members om
         JOIN users u ON u.id = om.user_id
         WHERE om.org_id = ?1
         ORDER BY om.created_at ASC`,
      )
      .bind(orgId)
      .all<{ user_id: string; email: string; full_name: string | null; role: string }>();

    return success({
      id: orgRow.id,
      name: orgRow.name,
      description,
      createdAt: orgRow.created_at,
      memberCount: memberRows.length,
      members: memberRows.map((m) => ({
        userId: m.user_id,
        email: m.email,
        fullName: m.full_name,
        role: m.role,
      })),
    });
  } catch (err) {
    const error = toError(err);
    logger.error('[OrgManager] getOrgDetail failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}

/**
 * Create a new organization and add the calling user as owner.
 */
export async function createOrg(
  name: string,
  description?: string,
): Promise<Result<{ orgId: string }, { code: string; message: string }>> {
  try {
    const auth = await requireMaster();
    if (!auth.ok) return auth;

    const trimmed = name.trim();
    if (!trimmed) {
      return failure({ code: 'VALIDATION', message: 'Organization name is required' });
    }

    const db = getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database not available' });
    }

    const orgId = crypto.randomUUID();
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'org';
    const settings = description ? JSON.stringify({ description }) : '{}';
    const now = new Date().toISOString();

    await db
      .prepare(
        'INSERT INTO organizations (id, name, slug, settings, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)',
      )
      .bind(orgId, trimmed, slug, settings, now)
      .run();

    await db
      .prepare('INSERT INTO org_members (org_id, user_id, role) VALUES (?1, ?2, \'owner\')')
      .bind(orgId, auth.value.userId)
      .run();

    logger.info('[OrgManager] Created org', { orgId, name: trimmed, by: auth.value.userId });
    return success({ orgId });
  } catch (err) {
    const error = toError(err);
    logger.error('[OrgManager] createOrg failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}

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

    const db = getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database not available' });
    }

    // Look up user by email
    const userRow = await db
      .prepare('SELECT id FROM users WHERE email = ?1 LIMIT 1')
      .bind(trimmedEmail)
      .first<{ id: string }>();

    if (!userRow) {
      return failure({ code: 'USER_NOT_FOUND', message: 'No user found with that email address' });
    }

    // Check if already a member
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

    const db = getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database not available' });
    }

    // Check if member exists
    const member = await db
      .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
      .bind(orgId, userId)
      .first<{ role: string }>();

    if (!member) {
      return failure({ code: 'NOT_FOUND', message: 'Member not found' });
    }

    // Prevent removing the last owner
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
