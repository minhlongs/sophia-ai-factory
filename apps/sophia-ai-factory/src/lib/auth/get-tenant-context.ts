/**
 * Tenant context resolver — Phase 4F.2.
 *
 * Returns the caller's `{ orgId, tier }` via a single D1 JOIN, saving
 * one roundtrip versus calling `resolveOrgId(...)` and `getUserTier(...)`
 * independently.
 *
 * Falls back to `null` whenever:
 *   - userId is missing
 *   - D1 binding is unreachable
 *   - user is not a member of any org
 *   - D1 throws
 *
 * Callers that only need one of the two values should keep using
 * `resolveOrgId` / `getUserTier` directly.
 */

import type { Tier } from '@/types'
import { normalizePlanToTier } from '@/lib/db/get-user-tier'
import { getD1Raw } from './resolve-org-id'

export interface TenantContext {
  orgId: string
  tier:  Tier
}

interface JoinRow {
  org_id: string
  plan:   string | null
}

export async function getTenantContext(
  userId: string | null | undefined,
  db?:    D1Database | null,
): Promise<TenantContext | null> {
  if (!userId) return null
  const d1 = db ?? getD1Raw()
  if (!d1) return null

  try {
    const row = await d1
      .prepare(
        `SELECT m.org_id   AS org_id,
                s.plan     AS plan
         FROM   org_members m
         LEFT JOIN subscriptions s
           ON   s.org_id = m.org_id
           AND  s.status = 'active'
         WHERE  m.user_id = ?
         LIMIT  1`,
      )
      .bind(userId)
      .first<JoinRow>()

    if (!row?.org_id) return null

    return {
      orgId: row.org_id,
      tier:  normalizePlanToTier(row.plan),
    }
  } catch {
    return null
  }
}
