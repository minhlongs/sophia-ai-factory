/**
 * Promo User Identity Resolver
 *
 * Layer: app/api/promo/redeem-free/service
 */

import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getAuth } from '@/seed/auth/better-auth-server';
import { getD1 } from '@/seed/db/client';
import type { ResolvedUser } from './types';

export async function findOrResolveUser(
  request: Request,
  email: string,
): Promise<ResolvedUser> {
  try {
    const auth = await getAuth();
    if (auth) {
      const session = await auth.api.getSession({ headers: request.headers });
      const sUser = session?.user as { id?: string; emailVerified?: boolean } | undefined;
      if (sUser?.id) {
        return { userId: sUser.id, sessionEmailVerified: sUser.emailVerified === true };
      }
    }
  } catch {
    /* not logged in */
  }

  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (user?.id) {
      return { userId: user.id, sessionEmailVerified: false };
    }
  } catch {
    /* not logged in */
  }

  const _db = await getD1();
  if (!_db) {
    return { userId: null, sessionEmailVerified: false };
  }
  const db = _db;
  try {
    const row = await db
      .prepare(`SELECT id FROM user WHERE email = ?1 LIMIT 1`)
      .bind(email)
      .first<{ id: string }>();
    return { userId: row?.id ?? null, sessionEmailVerified: false };
  } catch {
    return { userId: null, sessionEmailVerified: false };
  }
}
