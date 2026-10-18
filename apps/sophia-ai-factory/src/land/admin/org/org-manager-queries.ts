/**
 * org-manager-queries.ts — Land Layer
 * D1 SQL query helpers for organization management
 */

import type { OrgRow, OrgDetail } from './types';

export async function queryAllOrgs(db: D1Database): Promise<OrgRow[]> {
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

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    memberCount: r.member_count,
  }));
}

export async function queryOrgDetailById(
  db: D1Database,
  orgId: string,
): Promise<OrgDetail | null> {
  const orgRow = await db
    .prepare('SELECT id, name, settings, created_at FROM organizations WHERE id = ?1 LIMIT 1')
    .bind(orgId)
    .first<{ id: string; name: string; settings: string | null; created_at: string }>();

  if (!orgRow) {
    return null;
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

  return {
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
  };
}

export async function insertOrgWithOwner(
  db: D1Database,
  trimmedName: string,
  ownerUserId: string,
  description?: string,
): Promise<string> {
  const orgId = crypto.randomUUID();
  const slug =
    trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'org';
  const settings = description ? JSON.stringify({ description }) : '{}';
  const now = new Date().toISOString();

  await db
    .prepare(
      'INSERT INTO organizations (id, name, slug, settings, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)',
    )
    .bind(orgId, trimmedName, slug, settings, now)
    .run();

  await db
    .prepare("INSERT INTO org_members (org_id, user_id, role) VALUES (?1, ?2, 'owner')")
    .bind(orgId, ownerUserId)
    .run();

  return orgId;
}
