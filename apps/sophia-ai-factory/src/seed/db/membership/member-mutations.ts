/**
 * Organization Member Mutations
 * Layer: seed/db/membership
 */

import { createServerClient } from '@/seed/db/client'
import type { OrgRole } from './types'

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
    const db = createServerClient()
    await db.from('org_members').insert({
      org_id: orgId,
      user_id: userId,
      role,
    })
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
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
    const db = createServerClient()

    // Get current role of the user being removed
    const { data: member } = await db
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!member) return 'Member not found'

    const m = member as Record<string, string>
    if (m.role === 'owner') return 'Cannot remove the org owner'

    await db
      .from('org_members')
      .delete()
      .eq('org_id', orgId)
      .eq('user_id', userId)

    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
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
    const db = createServerClient()

    if (newRole === 'owner') return 'Cannot assign owner role through this API'

    const { data: member } = await db
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!member) return 'Member not found'

    const m = member as Record<string, string>
    if (m.role === 'owner') return 'Cannot change the org owner role'

    await db
      .from('org_members')
      .update({ role: newRole })
      .eq('org_id', orgId)
      .eq('user_id', userId)

    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}
