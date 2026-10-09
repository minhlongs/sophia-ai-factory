/**
 * Subaccount Member Management & Scoped RBAC
 *
 * Layer: tree/organizations (Pure domain logic - only imports from @/seed)
 * Conforms to: Sophia 4-Layer Architecture Doctrine (< 200 LOC)
 *
 * @module tree/organizations/subaccounts/subaccount-members
 */

import type { D1Database } from '@/seed/db/client';
import type {
  SubaccountMember,
  SubaccountRole,
} from '@/seed/types/agency-multitenancy';

interface MemberRow {
  id: string;
  subaccount_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

/**
 * Adds or updates a user's role within a subaccount.
 */
export async function addSubaccountMember(
  db: D1Database,
  subaccountId: string,
  userId: string,
  role: SubaccountRole
): Promise<SubaccountMember> {
  const normalizedRole = role.toLowerCase() as SubaccountRole;
  const now = new Date().toISOString();
  const id = `sm_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  await db
    .prepare(`
      INSERT INTO subaccount_members (id, subaccount_id, user_id, role, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(subaccount_id, user_id) DO UPDATE SET
        role = excluded.role
    `)
    .bind(id, subaccountId, userId, normalizedRole, now)
    .run();

  return {
    id,
    subaccountId,
    userId,
    role: normalizedRole,
    createdAt: now,
  };
}

/**
 * Retrieves a user's role in a specific subaccount.
 */
export async function getSubaccountMember(
  db: D1Database,
  subaccountId: string,
  userId: string
): Promise<SubaccountMember | null> {
  const row = await db
    .prepare('SELECT * FROM subaccount_members WHERE subaccount_id = ? AND user_id = ?')
    .bind(subaccountId, userId)
    .first<MemberRow>();

  if (!row) return null;
  return {
    id: row.id,
    subaccountId: row.subaccount_id,
    userId: row.user_id,
    role: row.role as SubaccountRole,
    createdAt: row.created_at,
  };
}

/**
 * Lists all members assigned to a client subaccount.
 */
export async function listSubaccountMembers(
  db: D1Database,
  subaccountId: string
): Promise<SubaccountMember[]> {
  const { results } = await db
    .prepare('SELECT * FROM subaccount_members WHERE subaccount_id = ? ORDER BY created_at ASC')
    .bind(subaccountId)
    .all<MemberRow>();

  return (results || []).map((row) => ({
    id: row.id,
    subaccountId: row.subaccount_id,
    userId: row.user_id,
    role: row.role as SubaccountRole,
    createdAt: row.created_at,
  }));
}

/**
 * Removes a member from a client subaccount.
 */
export async function removeSubaccountMember(
  db: D1Database,
  subaccountId: string,
  userId: string
): Promise<void> {
  await db
    .prepare('DELETE FROM subaccount_members WHERE subaccount_id = ? AND user_id = ?')
    .bind(subaccountId, userId)
    .run();
}
