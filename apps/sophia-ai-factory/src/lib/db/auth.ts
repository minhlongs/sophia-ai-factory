/**
 * Auth module — delegates to Better Auth for session management.
 *
 * Preserved: organization helpers (D1 direct queries).
 * Removed: custom JWT, password hashing, signIn/signUp, magic link.
 */

import { getD1Client } from './client';

// Re-export getCurrentUser from Better Auth session module (backward compat)
export { getCurrentUser } from '@/lib/better-auth-session';
import { toError } from '@/lib/utils/to-error';

export async function createOrganization(
  userId: string, name: string, slug: string,
): Promise<{ orgId: string | null; error: string | null }> {
  try {
    const db = await getD1Client();
    const orgId = crypto.randomUUID();

    await db.from('organizations').insert({ id: orgId, name, slug });
    await db.from('org_members').insert({ org_id: orgId, user_id: userId, role: 'owner' });
    await db.from('org_balances').insert({ org_id: orgId, balance: 0 });

    return { orgId, error: null };
  } catch (e) {
    return { orgId: null, error: toError(e).message };
  }
}

export async function getUserOrganization(
  userId: string,
): Promise<{ id: string; name: string; slug: string; role: string } | null> {
  try {
    const db = await getD1Client();
    const { data: member } = await db
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', userId)
      .single();

    if (!member) return null;
    const m = member as Record<string, string>;

    const { data: org } = await db
      .from('organizations')
      .select('id, name, slug')
      .eq('id', m.org_id)
      .single();

    if (!org) return null;
    const o = org as Record<string, string>;

    return { id: o.id, name: o.name, slug: o.slug, role: m.role };
  } catch {
    return null;
  }
}
