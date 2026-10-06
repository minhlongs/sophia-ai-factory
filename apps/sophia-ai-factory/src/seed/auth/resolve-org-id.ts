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
 * Implements high-frequency query caching:
 * - L1: In-memory Map cache with TTL (60s)
 * - L2: Cloudflare KV (KV_KV) with TTL (60s) when available
 *
 * Phase 4F.1 — replaces two byte-identical private copies in
 * `api/raas/workflows/route.ts` and `api/raas/workflows/[id]/route.ts`.
 */

import { getD1, type D1Client, type D1Database } from '@/seed/db/client'

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const ORG_ID_CACHE = new Map<string, CacheEntry<string | null>>();
const ORG_OWNER_CACHE = new Map<string, CacheEntry<string | null>>();
const ORG_ID_CACHE_TTL_MS = 60_000;
const NEGATIVE_CACHE_TTL_MS = 10_000;
const KV_TTL_SECONDS = 60;
const MAX_CACHE_SIZE = 1000;

function getKvBinding(): KVNamespace | null {
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as Record<string, unknown>;
    if (g.KV_KV) return g.KV_KV as KVNamespace;
    const env = (g as Record<string, Record<string, unknown>>).__env__;
    if (env?.KV_KV) return env.KV_KV as KVNamespace;
  }
  return null;
}

function setInL1OrgCache(userId: string, orgId: string | null, ttlMs = orgId ? ORG_ID_CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS): void {
  if (ORG_ID_CACHE.size >= MAX_CACHE_SIZE) {
    const oldestKey = ORG_ID_CACHE.keys().next().value;
    if (oldestKey) ORG_ID_CACHE.delete(oldestKey);
  }
  ORG_ID_CACHE.set(userId, {
    value: orgId,
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidateOrgIdCache(userId: string): void {
  ORG_ID_CACHE.delete(userId);
  const kv = getKvBinding();
  if (kv) {
    kv.delete(`org_id:${userId}`).catch(() => {});
  }
}

export function clearOrgIdCache(): void {
  ORG_ID_CACHE.clear();
  ORG_OWNER_CACHE.clear();
}

export async function getD1Raw(): Promise<D1Database | null> {
  return getD1();
}

async function queryFirst<T>(stmt: ReturnType<D1Database['prepare']>): Promise<T | null> {
  if (typeof stmt.first === 'function') {
    const row = await stmt.first<T>()
    return row ?? null
  }
  if (typeof stmt.all === 'function') {
    const res = await stmt.all<T>()
    return res?.results?.[0] ?? null
  }
  return null
}

export async function resolveOrgId(
  userId: string | null | undefined,
  db?: D1Database | D1Client | null,
): Promise<string | null> {
  if (!userId) return null;

  // 1. Check L1 in-memory cache
  const cached = ORG_ID_CACHE.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  // 2. Check L2 KV cache
  const kv = getKvBinding();
  if (kv) {
    try {
      const kvVal = await kv.get(`org_id:${userId}`);
      if (kvVal !== null) {
        const val = kvVal === '__NULL__' ? null : kvVal;
        setInL1OrgCache(userId, val);
        return val;
      }
    } catch {
      // non-fatal fallback
    }
  }

  const d1 = (db as { prepare?: unknown } | null | undefined)?.prepare ? db : (db ?? await getD1Raw())
  if (!d1) return null

  if (typeof (d1 as { prepare?: unknown }).prepare === 'function') {
    try {
      const stmt = (d1 as D1Database)
        .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
        .bind(userId)
      const row = await queryFirst<{ org_id: string }>(stmt)
      if (row?.org_id) {
        setInL1OrgCache(userId, row.org_id);
        if (kv) {
          kv.put(`org_id:${userId}`, row.org_id, { expirationTtl: KV_TTL_SECONDS }).catch(() => {});
        }
        return row.org_id;
      }
    } catch {
      // Continue to fallback
    }
    try {
      const stmt = (d1 as D1Database)
        .prepare('SELECT id FROM organizations WHERE user_id = ? LIMIT 1')
        .bind(userId)
      const orgRow = await queryFirst<{ id: string }>(stmt)
      if (orgRow?.id) {
        setInL1OrgCache(userId, orgRow.id);
        if (kv) {
          kv.put(`org_id:${userId}`, orgRow.id, { expirationTtl: KV_TTL_SECONDS }).catch(() => {});
        }
        return orgRow.id;
      }
    } catch {
      // Continue to user table fallback
    }
    try {
      const stmt = (d1 as D1Database)
        .prepare('SELECT org_id FROM user WHERE id = ? LIMIT 1')
        .bind(userId)
      const userRow = await queryFirst<{ org_id: string }>(stmt)
      if (userRow?.org_id) {
        setInL1OrgCache(userId, userRow.org_id);
        if (kv) {
          kv.put(`org_id:${userId}`, userRow.org_id, { expirationTtl: KV_TTL_SECONDS }).catch(() => {});
        }
        return userRow.org_id;
      }
      setInL1OrgCache(userId, null);
      if (kv) {
        kv.put(`org_id:${userId}`, '__NULL__', { expirationTtl: 10 }).catch(() => {});
      }
      return null;
    } catch {
      return null;
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
      if (orgId) {
        setInL1OrgCache(userId, orgId);
        return orgId;
      }
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
      if (id) {
        setInL1OrgCache(userId, id);
        return id;
      }
      setInL1OrgCache(userId, null);
      return null;
    } catch {
      return null;
    }
  }

  return null;
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
      const stmt = (d1 as D1Database)
        .prepare(
          `SELECT user_id FROM org_members
           WHERE org_id=?
           ORDER BY created_at ASC
           LIMIT 1`,
        )
        .bind(orgId)
      const row = await queryFirst<{ user_id: string }>(stmt)
      if (row?.user_id) return row.user_id
    } catch {
      // Continue to fallback
    }
    try {
      const stmt = (d1 as D1Database)
        .prepare('SELECT user_id FROM organizations WHERE id=? LIMIT 1')
        .bind(orgId)
      const orgRow = await queryFirst<{ user_id: string }>(stmt)
      if (orgRow?.user_id) return orgRow.user_id
      return null
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
