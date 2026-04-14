/**
 * Auth verification — delegates to Better Auth.
 *
 * This module is kept for backward compatibility with code that imports verifyJwt.
 * New code should use getCurrentUser() from '@/lib/better-auth-session' instead.
 */

import { getAuth } from '@/lib/better-auth-server';

/**
 * @deprecated Use getCurrentUser() or getCurrentUserFromHeaders() instead.
 * Verifies auth by checking Better Auth session from request headers.
 * Returns a JWT-like payload shape for backward compat.
 */
export async function verifyJwt(
  _token: string,
  headers?: Headers,
): Promise<Record<string, unknown> | null> {
  try {
    if (!headers) return null;
    const auth = getAuth();
    const session = await auth.api.getSession({ headers });
    if (!session) return null;

    const user = session.user as Record<string, unknown>;
    return {
      sub: session.user.id,
      email: session.user.email,
      role: user.role ?? 'user',
    };
  } catch {
    return null;
  }
}
