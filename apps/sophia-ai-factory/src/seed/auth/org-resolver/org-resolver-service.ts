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
import {
  queryOrgIdFromBuilder,
  queryOwnerFromBuilder,
} from './builder-org-queries';

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
