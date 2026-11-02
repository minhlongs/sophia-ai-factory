/**
 * Query-builder fallback helpers for organization resolution.
 * Layer: seed/auth/org-resolver
 */

import { isMissingTableError, rethrowUnlessMissingTable } from './d1-org-queries';

export type QueryBuilderLike = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => unknown;
    };
  };
};

type BuilderResult<T> = {
  data?: T | T[];
  error?: { message?: string; code?: string } | null;
};

async function runBuilderLookup<T>(
  qb: QueryBuilderLike,
  table: string,
  selectCol: string,
  eqCol: string,
  eqVal: string,
): Promise<T | null> {
  try {
    const query = qb.from(table).select(selectCol).eq(eqCol, eqVal);
    const q = query as {
      maybeSingle?: () => Promise<BuilderResult<T>>;
      single?: () => Promise<BuilderResult<T>>;
    };
    const res = typeof q.maybeSingle === 'function'
      ? await q.maybeSingle()
      : typeof q.single === 'function'
        ? await q.single()
        : await (query as unknown as Promise<BuilderResult<T>>);
    if (res?.error && res.error.code !== 'PGRST116' && !isMissingTableError(res.error.message ?? '')) {
      throw new Error(res.error.message ?? 'Builder query failed');
    }
    const row = Array.isArray(res?.data) ? res.data[0] : res?.data;
    return row ?? null;
  } catch (err) {
    rethrowUnlessMissingTable(err);
    return null;
  }
}

export async function queryOrgIdFromBuilder(
  client: unknown,
  userId: string,
): Promise<string | null> {
  const qb = client as QueryBuilderLike;
  const member = await runBuilderLookup<{ org_id?: string }>(qb, 'org_members', 'org_id', 'user_id', userId);
  if (member?.org_id) return member.org_id;

  const org = await runBuilderLookup<{ id?: string }>(qb, 'organizations', 'id', 'user_id', userId);
  return org?.id ?? null;
}

export async function queryOwnerFromBuilder(
  client: unknown,
  orgId: string,
): Promise<string | null> {
  const qb = client as QueryBuilderLike;
  const member = await runBuilderLookup<{ user_id?: string }>(qb, 'org_members', 'user_id', 'org_id', orgId);
  if (member?.user_id) return member.user_id;

  const org = await runBuilderLookup<{ user_id?: string }>(qb, 'organizations', 'user_id', 'id', orgId);
  return org?.user_id ?? null;
}
