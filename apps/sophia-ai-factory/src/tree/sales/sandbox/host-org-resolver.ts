/**
 * Host Agency Organization Resolver
 * Layer: tree/sales/sandbox
 */

import type { D1Database } from '@/seed/db/client'

/**
 * Resolves or creates an enterprise host organization in D1 to own demo subaccounts.
 */
export async function resolveHostAgencyOrg(db: D1Database, preferredOrgId?: string): Promise<string> {
  if (preferredOrgId) return preferredOrgId

  // 1. Look for existing host enterprise organization
  const existingOrg = await db
    .prepare("SELECT id FROM organizations WHERE id = 'org_enterprise_sales' OR name LIKE '%Enterprise%' LIMIT 1")
    .first<{ id: string }>()

  if (existingOrg?.id) {
    return existingOrg.id
  }

  // 2. Fallback to first available organization
  const anyOrg = await db
    .prepare('SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1')
    .first<{ id: string }>()

  if (anyOrg?.id) {
    return anyOrg.id
  }

  // 3. Create default enterprise host organization if table is empty
  const defaultOrgId = 'org_enterprise_sales'
  const now = new Date().toISOString()
  await db
    .prepare(`
      INSERT OR IGNORE INTO organizations (id, name, slug, created_at, updated_at)
      VALUES (?, 'Sophia Enterprise Sales Fleet', 'enterprise-sales', ?, ?)
    `)
    .bind(defaultOrgId, now, now)
    .run()

  return defaultOrgId
}
