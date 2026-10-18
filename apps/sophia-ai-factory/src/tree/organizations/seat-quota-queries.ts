/**
 * Organization Seat Quota D1 Queries
 *
 * Layer: tree/organizations (only imports from @/seed)
 *
 * @module tree/organizations/seat-quota-queries
 */

import type { D1Database } from '@/seed/db/client';

/**
 * Counts active confirmed members (checks organization_members first, then org_members fallback).
 */
export async function countActiveOrgMembers(
  db: D1Database,
  orgId: string,
): Promise<number> {
  try {
    const memRow = await db
      .prepare('SELECT COUNT(*) AS count FROM organization_members WHERE org_id = ?1')
      .bind(orgId)
      .first<{ count: number }>();
    if (memRow && Number(memRow.count) > 0) {
      return Number(memRow.count);
    }
    try {
      const legacyMemRow = await db
        .prepare('SELECT COUNT(*) AS count FROM org_members WHERE org_id = ?1')
        .bind(orgId)
        .first<{ count: number }>();
      return legacyMemRow ? Number(legacyMemRow.count) : Number(memRow?.count ?? 0);
    } catch {
      return Number(memRow?.count ?? 0);
    }
  } catch {
    try {
      const legacyMemRow = await db
        .prepare('SELECT COUNT(*) AS count FROM org_members WHERE org_id = ?1')
        .bind(orgId)
        .first<{ count: number }>();
      return legacyMemRow ? Number(legacyMemRow.count) : 0;
    } catch {
      return 0;
    }
  }
}

/**
 * Counts pending, unexpired invitations (checks organization_invitations first, then org_invitations fallback).
 */
export async function countPendingOrgInvites(
  db: D1Database,
  orgId: string,
  now: number,
): Promise<number> {
  try {
    const invRow = await db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM organization_invitations
         WHERE org_id = ?1 AND status = 'pending' AND expires_at > ?2`,
      )
      .bind(orgId, now)
      .first<{ count: number }>();
    if (invRow && Number(invRow.count) > 0) {
      return Number(invRow.count);
    }
    try {
      const legacyInvRow = await db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM org_invitations
           WHERE org_id = ?1 AND status = 'pending' AND expires_at > ?2`,
        )
        .bind(orgId, now)
        .first<{ count: number }>();
      return legacyInvRow ? Number(legacyInvRow.count) : Number(invRow?.count ?? 0);
    } catch {
      return Number(invRow?.count ?? 0);
    }
  } catch {
    try {
      const legacyInvRow = await db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM org_invitations
           WHERE org_id = ?1 AND status = 'pending' AND expires_at > ?2`,
        )
        .bind(orgId, now)
        .first<{ count: number }>();
      return legacyInvRow ? Number(legacyInvRow.count) : 0;
    } catch {
      return 0;
    }
  }
}
