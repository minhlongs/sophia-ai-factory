/**
 * isUserAdmin Helper
 *
 * Resolves admin status from Better Auth session role OR user_profiles DB role.
 * Replaces duplicated `userData?.role === 'admin' || user.role === 'admin'` pattern
 * across 6+ admin route handlers (Phase 25 DRY refactor).
 */

import type { User } from '@/lib/db/client';
import { createServerClient } from '@/lib/db/client';

interface UserProfileRoleRow {
  role: string | null;
}

/**
 * Returns true if the user has 'admin' role.
 * Checks Better Auth session role first (cheap), then falls back to user_profiles DB lookup.
 */
export async function isUserAdmin(user: User): Promise<boolean> {
  if (user.role === 'admin') return true;

  const db = createServerClient();
  const { data: rawData } = await db
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();
  const userData = rawData as UserProfileRoleRow | null;

  return userData?.role === 'admin';
}
