/**
 * `requireMasterTier()` — server-side gate for operator-only admin routes.
 *
 * Combines auth + tier check in one server-safe call. Use at the top of every
 * `/dashboard/admin/*` page server component.
 *
 * Decision binding (plan 260518-1728 §8 D2): operator role = `tier === 'MASTER'`.
 * Reuses existing tier enum — no DB schema change.
 *
 * Usage:
 *   import { requireMasterTier } from '@/seed/auth/require-master-tier';
 *
 *   export default async function AdminPage() {
 *     const user = await requireMasterTier();
 *     // ... user is guaranteed authenticated AND tier=MASTER
 *   }
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import type { User } from '@/seed/db/client';

export interface RequireMasterTierOptions {
  /** Redirect target when no session is present (default: `/login`). */
  loginRedirect?: string;
  /** Redirect target when session exists but tier !== MASTER (default: `/dashboard?error=admin_required`). */
  denyRedirect?: string;
}

/**
 * Throws via `redirect()` (return type `never`) if user is missing or non-MASTER tier;
 * otherwise returns the resolved `User`.
 *
 * Server Component / Server Action only — uses `next/headers` transitively.
 */
export async function requireMasterTier(
  opts: RequireMasterTierOptions = {},
): Promise<User> {
  const loginRedirect = opts.loginRedirect ?? '/login';
  const denyRedirect = opts.denyRedirect ?? '/dashboard?error=admin_required';

  const user = await getCurrentUser();
  if (!user) {
    redirect(loginRedirect);
  }

  const tier = await resolveUserTier(user.id);
  if (tier !== 'MASTER') {
    redirect(denyRedirect);
  }

  return user;
}
