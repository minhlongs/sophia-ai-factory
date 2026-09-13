/**
 * Auth module — delegates to Better Auth for session management.
 *
 * Preserved: organization helpers (D1 direct queries).
 * Removed: custom JWT, password hashing, signIn/signUp, magic link.
 */

import { createServerClient } from '@/seed/db/client';
import { resolveOrgId } from '@/seed/auth/workspace-access';

// Re-export getCurrentUser from Better Auth session module (backward compat)
export { getCurrentUser } from '@/seed/auth/better-auth-session';
import { toError } from '@/seed/utils/to-error';

export async function createOrganization(
  userId: string, name: string, slug: string,
): Promise<{ orgId: string | null; error: string | null }> {
  try {
    const db = createServerClient();
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
    const db = createServerClient();
    const { data: member } = await db
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', userId)
      .single();

    let orgId = (member as Record<string, string> | undefined)?.org_id;
    let role = (member as Record<string, string> | undefined)?.role || 'member';

    if (!orgId) {
      const resolved = await resolveOrgId(userId, db);
      if (!resolved) return null;
      orgId = resolved;
      role = 'owner';
    }

    const { data: org } = await db
      .from('organizations')
      .select('id, name, slug')
      .eq('id', orgId)
      .single();

    if (!org) return null;
    const o = org as Record<string, string>;

    return { id: o.id, name: o.name, slug: o.slug, role };
  } catch {
    return null;
  }
}
