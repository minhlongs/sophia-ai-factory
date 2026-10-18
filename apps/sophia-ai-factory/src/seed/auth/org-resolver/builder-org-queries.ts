/**
 * Query-builder fallback helpers for organization resolution.
 * Layer: seed/auth/org-resolver
 */

export type QueryBuilderLike = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => unknown;
    };
  };
};

export async function queryOrgIdFromBuilder(
  client: unknown,
  userId: string,
): Promise<string | null> {
  const qb = client as QueryBuilderLike;
  try {
    const query = qb.from('org_members').select('org_id').eq('user_id', userId);
    const q = query as {
      maybeSingle?: () => Promise<{ data?: { org_id?: string } }>;
      single?: () => Promise<{ data?: { org_id?: string } }>;
    };
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
    const q = query as {
      maybeSingle?: () => Promise<{ data?: { id?: string } }>;
      single?: () => Promise<{ data?: { id?: string } }>;
    };
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

export async function queryOwnerFromBuilder(
  client: unknown,
  orgId: string,
): Promise<string | null> {
  const qb = client as QueryBuilderLike;
  try {
    const query = qb.from('org_members').select('user_id').eq('org_id', orgId);
    const q = query as {
      maybeSingle?: () => Promise<{ data?: { user_id?: string } }>;
      single?: () => Promise<{ data?: { user_id?: string } }>;
    };
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
    const q = query as {
      maybeSingle?: () => Promise<{ data?: { user_id?: string } }>;
      single?: () => Promise<{ data?: { user_id?: string } }>;
    };
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
