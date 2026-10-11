import type { D1Client, D1Database } from '@/seed/db/client';
import {
  getFromL1OrgCache,
  setInL1OrgCache,
  getKvBinding,
  KV_TTL_SECONDS,
} from './session-org-cache';
import {
  getD1Raw,
  queryOrgIdFromD1,
  queryOrgOwnerFromD1,
} from './d1-org-queries';

type QueryBuilderLike = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => unknown;
    };
  };
};

async function queryOrgIdFromBuilder(client: unknown, userId: string): Promise<string | null> {
  const qb = client as QueryBuilderLike;
  try {
    const query = qb.from('org_members').select('org_id').eq('user_id', userId);
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
    const query = qb.from('organizations').select('id').eq('user_id', userId);
    const q = query as { maybeSingle?: () => Promise<{ data?: { id?: string } }>; single?: () => Promise<{ data?: { id?: string } }> };
    const res = typeof q.maybeSingle === 'function'
      ? await q.maybeSingle()
      : typeof q.single === 'function'
        ? await q.single()
        : await (query as unknown as Promise<{ data?: { id?: string } }>);
    const id = res?.data?.id ?? (Array.isArray(res?.data) ? (res.data[0] as { id?: string })?.id : undefined);
    if (id) return id;
    return null;
  } catch {
    return null;
  }
}

async function queryOwnerFromBuilder(client: unknown, orgId: string): Promise<string | null> {
  const qb = client as QueryBuilderLike;
  try {
    const query = qb.from('org_members').select('user_id').eq('org_id', orgId);
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
    const query = qb.from('organizations').select('user_id').eq('id', orgId);
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

export async function resolveOrgId(
  userId: string | null | undefined,
  db?: D1Database | D1Client | null,
): Promise<string | null> {
  if (!userId) return null;

  const cached = getFromL1OrgCache(userId);
  if (cached !== undefined) return cached;

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

  const d1 = (db as { prepare?: unknown } | null | undefined)?.prepare ? db : (db ?? await getD1Raw());
  if (!d1) return null;

  if (typeof (d1 as { prepare?: unknown }).prepare === 'function') {
    const orgId = await queryOrgIdFromD1(d1 as D1Database, userId);
    if (orgId) {
      setInL1OrgCache(userId, orgId);
      if (kv) kv.put(`org_id:${userId}`, orgId, { expirationTtl: KV_TTL_SECONDS }).catch(() => {});
      return orgId;
    }
    setInL1OrgCache(userId, null);
    if (kv) kv.put(`org_id:${userId}`, '__NULL__', { expirationTtl: 10 }).catch(() => {});
    return null;
  }

  if (typeof (d1 as unknown as { from?: unknown }).from === 'function') {
    const orgId = await queryOrgIdFromBuilder(d1, userId);
    setInL1OrgCache(userId, orgId);
    return orgId;
  }

  return null;
}

export async function resolveOrgOwnerUserId(
  orgId: string | null | undefined,
  db?: D1Database | D1Client | null,
): Promise<string | null> {
  if (!orgId) return null;
  const d1 = (db as { prepare?: unknown } | null | undefined)?.prepare ? db : (db ?? await getD1Raw());
  if (!d1) return null;

  if (typeof (d1 as { prepare?: unknown }).prepare === 'function') {
    return queryOrgOwnerFromD1(d1 as D1Database, orgId);
  }

  if (typeof (d1 as unknown as { from?: unknown }).from === 'function') {
    return queryOwnerFromBuilder(d1, orgId);
  }

  return null;
}
