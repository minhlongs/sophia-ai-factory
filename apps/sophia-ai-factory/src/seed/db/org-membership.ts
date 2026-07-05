import { createServerClient } from '@/seed/db/client';
import { type OrgRole } from '@/seed/auth/rbac';
export type { OrgRole };

/**
 * Organization member roles.
 * - owner: created the org, cannot be removed or demoted
 * - admin: can manage members (invite/remove/change roles)
 * - member: can use all features
 * - viewer: read-only access
 */
export const ORG_ROLES: OrgRole[] = ['owner', 'admin', 'member', 'viewer'];

/** Roles that have member management permissions */
export const MANAGER_ROLES: OrgRole[] = ['owner', 'admin'];

export interface OrgMembership {
  orgId: string;
  role: OrgRole;
}

export type OrgCheckResult =
  | { authorized: true; orgId: string; role: OrgRole }
  | { authorized: false; error: string };

export interface OrgMemberRow {
  id: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
  email?: string;
  name?: string;
}

/**
 * Validate that the authenticated user belongs to an organization.
 * Returns the orgId and role on success, or an error result on failure.
 */
export async function requireOrgMembership(userId: string): Promise<OrgCheckResult> {
  const db = createServerClient();
  const { data: membership } = await db
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    return {
      authorized: false,
      error: 'Forbidden: user is not a member of any organization',
    };
  }

  const m = membership as Record<string, string>;
  return {
    authorized: true,
    orgId: m.org_id,
    role: m.role as OrgRole,
  };
}

/**
 * Check that the user has at least the given role in their org.
 * Role hierarchy: owner > admin > member > viewer
 */
export async function requireMinRole(
  userId: string,
  minRole: OrgRole,
): Promise<OrgCheckResult> {
  const membership = await requireOrgMembership(userId);
  if (!membership.authorized) return membership;

  const hierarchy: Record<OrgRole, number> = {
    owner: 4,
    admin: 3,
    member: 2,
    viewer: 1,
  };

  const userLevel = hierarchy[membership.role];
  const requiredLevel = hierarchy[minRole];

  if (userLevel < requiredLevel) {
    return {
      authorized: false,
      error: `Forbidden: requires role '${minRole}' or higher, current role is '${membership.role}'`,
    };
  }

  return membership;
}

/**
 * Check that the user has manager-level access (owner or admin).
 */
export async function requireManagerRole(
  userId: string,
): Promise<OrgCheckResult> {
  return requireMinRole(userId, 'admin');
}

/**
 * Get all members of an org.
 */
export async function getOrgMembers(orgId: string): Promise<OrgMemberRow[]> {
  const db = createServerClient();
  const { data: members } = await db
    .from('org_members')
    .select('id, user_id, role, created_at')
    .eq('org_id', orgId);

  if (!members) return [];

  const rows = members as Record<string, string>[];
  return rows.map((m) => ({
    id: m.id,
    userId: m.user_id,
    role: m.role as OrgRole,
    createdAt: m.created_at,
  }));
}

/**
 * Add a member to the org with the given role.
 * Returns null on success, or an error string on failure.
 */
export async function addOrgMember(
  orgId: string,
  userId: string,
  role: OrgRole = 'member',
): Promise<string | null> {
  try {
    const db = createServerClient();
    await db.from('org_members').insert({
      org_id: orgId,
      user_id: userId,
      role,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/**
 * Remove a member from the org (fails if they are the owner).
 */
export async function removeOrgMember(
  orgId: string,
  userId: string,
): Promise<string | null> {
  try {
    const db = createServerClient();

    // Get current role of the user being removed
    const { data: member } = await db
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!member) return 'Member not found';

    const m = member as Record<string, string>;
    if (m.role === 'owner') return 'Cannot remove the org owner';

    await db
      .from('org_members')
      .delete()
      .eq('org_id', orgId)
      .eq('user_id', userId);

    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/**
 * Update a member's role in the org.
 * Fails if the target user is the owner (owner role is immutable).
 */
export async function updateOrgMemberRole(
  orgId: string,
  userId: string,
  newRole: OrgRole,
): Promise<string | null> {
  try {
    const db = createServerClient();

    if (newRole === 'owner') return 'Cannot assign owner role through this API';

    const { data: member } = await db
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!member) return 'Member not found';

    const m = member as Record<string, string>;
    if (m.role === 'owner') return 'Cannot change the org owner role';

    await db
      .from('org_members')
      .update({ role: newRole })
      .eq('org_id', orgId)
      .eq('user_id', userId);

    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
