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

import { getD1, type D1Client, type D1Database } from '@/seed/db/client'

export async function getD1Raw(): Promise<D1Database | null> {
  return getD1();
}

export async function resolveOrgId(
  userId: string | null | undefined,
  db?: D1Database | D1Client | null,
): Promise<string | null> {
  if (!userId) return null
  const d1 = (db as { prepare?: unknown } | null | undefined)?.prepare ? db : (db ?? await getD1Raw())
  if (!d1) return null

  if (typeof (d1 as { prepare?: unknown }).prepare === 'function') {
    try {
      const row = await (d1 as D1Database)
        .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
        .bind(userId)
        .first<{ org_id: string }>()
      if (row?.org_id) return row.org_id
    } catch {
      // Continue to fallback
    }
    try {
      const orgRow = await (d1 as D1Database)
        .prepare('SELECT id FROM organizations WHERE user_id = ? LIMIT 1')
        .bind(userId)
        .first<{ id: string }>()
      return orgRow?.id ?? null
    } catch {
      return null
    }
  }

  // Fallback for query-builder / Supabase mock clients
  if (typeof (d1 as unknown as { from?: unknown }).from === 'function') {
    try {
      const query = (d1 as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: unknown) => unknown } } })
        .from('org_members')
        .select('org_id')
        .eq('user_id', userId);
      const q = query as { maybeSingle?: () => Promise<{ data?: { org_id?: string } }>; single?: () => Promise<{ data?: { org_id?: string } }> };
      const res = typeof q.maybeSingle === 'function'
        ? await q.maybeSingle()
        : typeof q.single === 'function'
          ? await q.single()
          : await (query as unknown as Promise<{ data?: { org_id?: string } }>);
      const orgId = res?.data?.org_id ?? (Array.isArray(res?.data) ? (res.data[0] as { org_id?: string })?.org_id : undefined);
      if (orgId) return orgId;
    } catch {
      // Continue to organizations
    }
    try {
      const query = (d1 as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: unknown) => unknown } } })
        .from('organizations')
        .select('id')
        .eq('user_id', userId);
      const q = query as { maybeSingle?: () => Promise<{ data?: { id?: string } }>; single?: () => Promise<{ data?: { id?: string } }> };
      const res = typeof q.maybeSingle === 'function'
        ? await q.maybeSingle()
        : typeof q.single === 'function'
          ? await q.single()
          : await (query as unknown as Promise<{ data?: { id?: string } }>);
      const id = res?.data?.id ?? (Array.isArray(res?.data) ? (res.data[0] as { id?: string })?.id : undefined);
      return id ?? null;
    } catch {
      return null;
    }
  }

  return null
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
  db?:   D1Database | D1Client | null,
): Promise<string | null> {
  if (!orgId) return null
  const d1 = (db as { prepare?: unknown } | null | undefined)?.prepare ? db : (db ?? await getD1Raw())
  if (!d1) return null

  if (typeof (d1 as { prepare?: unknown }).prepare === 'function') {
    try {
      const row = await (d1 as D1Database)
        .prepare(
          `SELECT user_id FROM org_members
           WHERE org_id=?
           ORDER BY created_at ASC
           LIMIT 1`,
        )
        .bind(orgId)
        .first<{ user_id: string }>()
      if (row?.user_id) return row.user_id
    } catch {
      // Continue to fallback
    }
    try {
      const orgRow = await (d1 as D1Database)
        .prepare('SELECT user_id FROM organizations WHERE id=? LIMIT 1')
        .bind(orgId)
        .first<{ user_id: string }>()
      return orgRow?.user_id ?? null
    } catch {
      return null
    }
  }

  // Fallback for query-builder / Supabase mock clients
  if (typeof (d1 as unknown as { from?: unknown }).from === 'function') {
    try {
      const query = (d1 as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: unknown) => unknown } } })
        .from('org_members')
        .select('user_id')
        .eq('org_id', orgId);
      const q = query as { maybeSingle?: () => Promise<{ data?: { user_id?: string } }>; single?: () => Promise<{ data?: { user_id?: string } }> };
      const res = typeof q.maybeSingle === 'function'
        ? await q.maybeSingle()
        : typeof q.single === 'function'
          ? await q.single()
          : await (query as unknown as Promise<{ data?: { user_id?: string } }>);
      const userId = res?.data?.user_id ?? (Array.isArray(res?.data) ? (res.data[0] as { user_id?: string })?.user_id : undefined);
      if (userId) return userId;
    } catch {
      // Continue to organizations
    }
    try {
      const query = (d1 as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: unknown) => unknown } } })
        .from('organizations')
        .select('user_id')
        .eq('id', orgId);
      const q = query as { maybeSingle?: () => Promise<{ data?: { user_id?: string } }>; single?: () => Promise<{ data?: { user_id?: string } }> };
      const res = typeof q.maybeSingle === 'function'
        ? await q.maybeSingle()
        : typeof q.single === 'function'
          ? await q.single()
          : await (query as unknown as Promise<{ data?: { user_id?: string } }>);
      const userId = res?.data?.user_id ?? (Array.isArray(res?.data) ? (res.data[0] as { user_id?: string })?.user_id : undefined);
      return userId ?? null;
    } catch {
      return null;
    }
  }

  return null
}
