import { getD1, type D1Database } from '@/seed/db/client';

export async function getD1Raw(): Promise<D1Database | null> {
  return getD1();
}

export async function queryFirst<T>(stmt: ReturnType<D1Database['prepare']>): Promise<T | null> {
  if (typeof stmt.first === 'function') {
    const row = await stmt.first<T>();
    return row ?? null;
  }
  if (typeof stmt.all === 'function') {
    const res = await stmt.all<T>();
    return res?.results?.[0] ?? null;
  }
  return null;
}

export async function queryOrgIdFromD1(d1: D1Database, userId: string): Promise<string | null | undefined> {
  try {
    const stmt = d1
      .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
      .bind(userId);
    const row = await queryFirst<{ org_id: string }>(stmt);
    if (row?.org_id) return row.org_id;
  } catch {
    // Continue to fallback
  }

  try {
    const stmt = d1
      .prepare('SELECT id FROM organizations WHERE user_id = ? LIMIT 1')
      .bind(userId);
    const orgRow = await queryFirst<{ id: string }>(stmt);
    if (orgRow?.id) return orgRow.id;
  } catch {
    // Continue to user table fallback
  }

  try {
    const stmt = d1
      .prepare('SELECT org_id FROM user WHERE id = ? LIMIT 1')
      .bind(userId);
    const userRow = await queryFirst<{ org_id: string }>(stmt);
    if (userRow?.org_id) return userRow.org_id;
    return null;
  } catch {
    return null;
  }
}

export async function queryOrgOwnerFromD1(d1: D1Database, orgId: string): Promise<string | null> {
  try {
    const stmt = d1
      .prepare(
        `SELECT user_id FROM org_members
         WHERE org_id=?
         ORDER BY created_at ASC
         LIMIT 1`,
      )
      .bind(orgId);
    const row = await queryFirst<{ user_id: string }>(stmt);
    if (row?.user_id) return row.user_id;
  } catch {
    // Continue to fallback
  }

  try {
    const stmt = d1
      .prepare('SELECT user_id FROM organizations WHERE id=? LIMIT 1')
      .bind(orgId);
    const orgRow = await queryFirst<{ user_id: string }>(stmt);
    if (orgRow?.user_id) return orgRow.user_id;
    return null;
  } catch {
    return null;
  }
}
