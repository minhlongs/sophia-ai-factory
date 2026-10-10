'use server';

/**
 * org-manager.ts — Land Layer
 * Organization lifecycle coordinator (listing, detail, creation)
 */

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { OrgRow, OrgDetail } from './types';
import { requireMaster } from './role-guard';

/**
 * List all organizations with member counts.
 */
export async function listOrgs(): Promise<
  Result<OrgRow[], { code: string; message: string }>
> {
  try {
    const auth = await requireMaster();
    if (!auth.ok) return auth;

    const db = await getD1();
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

    const db = await getD1();
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

    const db = await getD1();
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
