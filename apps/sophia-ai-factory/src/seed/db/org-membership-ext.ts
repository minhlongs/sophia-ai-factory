/**
 * Extended org membership with role-based access control.
 *
 * Provides D1-backed CRUD for org member roles and permission checks.
 * Role column already exists in org_members (migration 0001-init, recreated in 0088).
 *
 * @module seed/db/org-membership-ext
 */

import { success, failure, type Result } from '@/seed/types/result';
import type { D1Database } from '@/seed/db/client';
import type { OrgRole, Permission } from '@/seed/auth/rbac';
import { hasPermission } from '@/seed/auth/rbac';

/**
 * Set a member's role within an organization.
 * Returns failure if the member is not found in the org.
 */
export async function setMemberRole(
  db: D1Database,
  orgId: string,
  userId: string,
  role: OrgRole,
): Promise<Result<void, Error>> {
  try {
    const result = await db
      .prepare(
        `UPDATE org_members SET role = ?1 WHERE org_id = ?2 AND user_id = ?3`,
      )
      .bind(role, orgId, userId)
      .run();

    if (result.meta.changes === 0) {
      return failure(new Error('Member not found in organization'));
    }

    return success(undefined);
  } catch (err) {
    return failure(
      err instanceof Error ? err : new Error(String(err)),
    );
  }
}

/**
 * Get a member's role within an organization.
 * Returns null if the member does not exist in the org.
 */
export async function getMemberRole(
  db: D1Database,
  orgId: string,
  userId: string,
): Promise<Result<OrgRole | null, Error>> {
  try {
    const row = await db
      .prepare(
        `SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1`,
      )
      .bind(orgId, userId)
      .first<{ role: string }>();

    if (!row) return success(null);

    return success(row.role as OrgRole);
  } catch (err) {
    return failure(
      err instanceof Error ? err : new Error(String(err)),
    );
  }
}

export interface OrgMemberRow {
  userId: string;
  role: OrgRole;
}

/**
 * Get all members of an organization with their roles.
 * Returns an empty array if the org has no members.
 */
export async function getOrgMembers(
  db: D1Database,
  orgId: string,
): Promise<Result<OrgMemberRow[], Error>> {
  try {
    const { results } = await db
      .prepare(
        `SELECT user_id, role FROM org_members WHERE org_id = ?1`,
      )
      .bind(orgId)
      .all<{ user_id: string; role: string }>();

    return success(
      results.map((r) => ({
        userId: r.user_id,
        role: r.role as OrgRole,
      })),
    );
  } catch (err) {
    return failure(
      err instanceof Error ? err : new Error(String(err)),
    );
  }
}

/**
 * Check if a member has a specific permission within an organization.
 * Returns false if the member does not exist or the role lacks the permission.
 */
export async function checkOrgPermission(
  db: D1Database,
  orgId: string,
  userId: string,
  permission: Permission,
): Promise<Result<boolean, Error>> {
  try {
    const roleResult = await getMemberRole(db, orgId, userId);
    if (!roleResult.ok) return roleResult;

    const role = roleResult.value;
    if (!role) return success(false);

    return success(hasPermission(role, permission));
  } catch (err) {
    return failure(
      err instanceof Error ? err : new Error(String(err)),
    );
  }
}
