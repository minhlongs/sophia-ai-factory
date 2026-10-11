/**
 * Organization Member Queries
 * Layer: seed/db/membership
 */

import { createServerClient, getD1 } from '@/seed/db/client'
import type { OrgMemberRow, OrgMemberWithDetails, OrgRole } from './types'

/**
 * Get all members of an org.
 */
export async function getOrgMembers(orgId: string): Promise<OrgMemberRow[]> {
  const db = createServerClient()
  const { data: members } = await db
    .from('org_members')
    .select('id, user_id, role, created_at')
    .eq('org_id', orgId)

  if (!members) return []

  const rows = members as Record<string, string>[]
  return rows.map((m) => ({
    id: m.id,
    userId: m.user_id,
    role: m.role as OrgRole,
    createdAt: m.created_at,
  }))
}

/**
 * Get all members of an org enriched with user profile details via a single batch query (O(1)).
 */
export async function getOrgMembersWithDetails(orgId: string): Promise<OrgMemberWithDetails[]> {
  const members = await getOrgMembers(orgId)
  if (members.length === 0) return []

  const userIds = Array.from(new Set(members.map((m) => m.userId)))
  const userMap = new Map<string, { email: string; name: string }>()

  try {
    const d1 = await getD1()
    if (d1) {
      const placeholders = userIds.map((_, i) => `?${i + 1}`).join(', ')
      const result = await d1
        .prepare(`SELECT id, email, name FROM user WHERE id IN (${placeholders})`)
        .bind(...userIds)
        .all<{ id: string; email: string; name: string }>()

      for (const row of result.results ?? []) {
        userMap.set(row.id, { email: row.email ?? '', name: row.name ?? '' })
      }
    }
  } catch {
    // Non-fatal — proceed with blank details
  }

  return members.map((member) => {
    const details = userMap.get(member.userId) ?? { email: '', name: '' }
    return {
      ...member,
      email: details.email,
      name: details.name,
    }
  })
}
