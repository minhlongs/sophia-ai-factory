/**
 * Resolve tenant-scope `org_id` for a user.
 *
 * Walks the D1 binding from (a) `globalThis.__env.DB`,
 * (b) Symbol('__cloudflare-context__').env.DB, (c) `globalThis.__D1_DB`.
 *
 * Returns the user's `org_id` from `org_members`, or `null` if the user
 * is not a member of any org (or D1 is unreachable). Callers that need
 * a single-tenant fallback should do `?? userId`.
 *
 * Phase 4F.1 — replaces two byte-identical private copies in
 * `api/raas/workflows/route.ts` and `api/raas/workflows/[id]/route.ts`.
 */

export function getD1Raw(): D1Database | null {
  const envHolder = globalThis as unknown as Record<string, Record<string, unknown>>
  const env = envHolder.__env
  if (env?.DB) return env.DB as D1Database

  const ctxSymbol = Symbol.for('__cloudflare-context__')
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[ctxSymbol]
  if (ctx?.env?.DB) return ctx.env.DB as D1Database

  const g = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined
  return g ?? null
}

export async function resolveOrgId(
  userId: string | null | undefined,
  db?: D1Database | null,
): Promise<string | null> {
  if (!userId) return null
  const d1 = db ?? getD1Raw()
  if (!d1) return null
  try {
    const row = await d1
      .prepare('SELECT org_id FROM org_members WHERE user_id=? LIMIT 1')
      .bind(userId)
      .first<{ org_id: string }>()
    return row?.org_id ?? null
  } catch {
    return null
  }
}

/**
 * Inverse of `resolveOrgId` — given an org, return the earliest member's
 * user_id. Powers Phase 4G-WIRE: cron-driven LLM callers (which only
 * hold `workflow.org_id`) can resolve the org owner's user_id so the
 * BYOK resolver can check for a per-user key.
 *
 * Solo-company assumption: 1 org usually = 1 user. For multi-member
 * orgs the earliest joiner is treated as the BYOK key owner.
 * Returns null on missing orgId / D1 unavailable / no members / throw.
 */
export async function resolveOrgOwnerUserId(
  orgId: string | null | undefined,
  db?:   D1Database | null,
): Promise<string | null> {
  if (!orgId) return null
  const d1 = db ?? getD1Raw()
  if (!d1) return null
  try {
    const row = await d1
      .prepare(
        `SELECT user_id FROM org_members
         WHERE org_id=?
         ORDER BY created_at ASC
         LIMIT 1`,
      )
      .bind(orgId)
      .first<{ user_id: string }>()
    return row?.user_id ?? null
  } catch {
    return null
  }
}
