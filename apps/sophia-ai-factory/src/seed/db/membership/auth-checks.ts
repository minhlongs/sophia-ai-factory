/**
 * Organization Membership Authorization Checks
 * Layer: seed/db/membership
 */

import { createServerClient } from '@/seed/db/client'
import type { OrgCheckResult, OrgRole } from './types'

/**
 * Validate that the authenticated user belongs to an organization.
 * Returns the orgId and role on success, or an error result on failure.
 */
export async function requireOrgMembership(userId: string): Promise<OrgCheckResult> {
  const db = createServerClient()
  const { data: membership } = await db
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) {
    return {
      authorized: false,
      error: 'Forbidden: user is not a member of any organization',
    }
  }

  const m = membership as Record<string, string>
  return {
    authorized: true,
    orgId: m.org_id,
    role: m.role as OrgRole,
  }
}

/**
 * Check that the user has at least the given role in their org.
 * Role hierarchy: owner > admin > member > viewer
 */
export async function requireMinRole(
  userId: string,
  minRole: OrgRole,
): Promise<OrgCheckResult> {
  const membership = await requireOrgMembership(userId)
  if (!membership.authorized) return membership

  const hierarchy: Record<OrgRole, number> = {
    owner: 4,
    admin: 3,
    member: 2,
    viewer: 1,
  }

  const userLevel = hierarchy[membership.role]
  const requiredLevel = hierarchy[minRole]

  if (userLevel < requiredLevel) {
    return {
      authorized: false,
      error: `Forbidden: requires role '${minRole}' or higher, current role is '${membership.role}'`,
    }
  }

  return membership
}

/**
 * Check that the user has manager-level access (owner or admin).
 */
export async function requireManagerRole(
  userId: string,
): Promise<OrgCheckResult> {
  return requireMinRole(userId, 'admin')
}
