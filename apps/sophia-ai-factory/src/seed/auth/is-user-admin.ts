/**
 * isUserAdmin Helpers
 *
 * Resolves admin status from Better Auth session role OR user_profiles DB role.
 * Replaces duplicated `userData?.role === 'admin' || user.role === 'admin'` pattern
 * across 6+ admin route handlers (Phase 25 DRY refactor).
 */

import type { User } from '@/seed/db/client';
import { createServerClient } from '@/seed/db/client';

interface UserProfileRoleRow {
  role: string | null;
}

/**
 * Returns true if the user has 'admin' role.
 * Fast-path: returns true immediately if session role is 'admin'.
 * Otherwise (session role is 'user', missing, or any non-admin value), unconditionally
 * queries user_profiles for promotion-after-session — DB is source of truth.
 */
export async function isUserAdmin(user: User): Promise<boolean> {
  const { isAdmin } = await isUserAdminWithRole(user);
  return isAdmin;
}

/**
 * Like `isUserAdmin` but also returns the resolved DB role (or session role if fast-path hit).
 * Use when caller needs the role string for downstream logic (audit logs, tier inference)
 * to avoid a second DB lookup.
 */
export async function isUserAdminWithRole(
  user: User
): Promise<{ isAdmin: boolean; dbRole: string | null }> {
  if (user.role === 'admin') {
    return { isAdmin: true, dbRole: 'admin' };
  }

  const db = createServerClient();
  const { data: rawData } = await db
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();
  const userData = rawData as UserProfileRoleRow | null;
  const dbRole = userData?.role ?? null;

  return { isAdmin: dbRole === 'admin', dbRole };
}
