/**
 * Server-side session helpers — drop-in replacement for old getCurrentUser().
 *
 * Usage in Server Components / Server Actions:
 * import { getCurrentUser } from '@/seed/auth/better-auth-session';
 * const user = await getCurrentUser();
 */

import { getAuth } from '@/seed/auth/better-auth-server';
import type { User } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { unstable_rethrow } from 'next/navigation';
import {
  AuthSystemError,
  getCurrentUserFromHeaders,
  getSessionFromHeaders,
  hasAuthCredential,
  type RawSessionData,
} from './better-auth-headers-session';

export {
  AuthSystemError,
  getCurrentUserFromHeaders,
  getSessionFromHeaders,
  type RawSessionData,
};

/**
 * Get the full Better Auth session (user + session metadata).
 * Returns null if not authenticated.
 */
export async function getSession() {
  try {
    const { headers } = await import('next/headers');
    const requestHeaders = await headers();
    if (!hasAuthCredential(requestHeaders)) return null;

    const auth = await getAuth();
    if (!auth) return null;
    const session = await auth.api.getSession({
      headers: requestHeaders,
    });
    return session;
  } catch (err) {
    unstable_rethrow(err);
    logger.error('[better-auth-session] getSession failed', err instanceof Error ? err : new Error(String(err)), {
      errorName: err instanceof Error ? err.constructor.name : typeof err,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Get current user — backward-compatible with old getCurrentUser() shape.
 * Returns { id, email, full_name, avatar_url, role } or null.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;

  const user = session.user as Record<string, unknown>;
  return {
    id: session.user.id,
    email: session.user.email,
    full_name: (session.user.name ?? undefined) as string | undefined,
    avatar_url: (session.user.image ?? undefined) as string | undefined,
    role: (user.role as string) ?? 'user',
  };
}
