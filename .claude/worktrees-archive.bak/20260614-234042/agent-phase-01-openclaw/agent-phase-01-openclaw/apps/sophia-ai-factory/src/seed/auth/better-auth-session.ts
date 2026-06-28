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

/** Thrown when auth lookup fails due to a system/DB error (not "no session"). */
export class AuthSystemError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'AuthSystemError';
  }
}

function hasAuthCredential(headers: Headers): boolean {
  return Boolean(headers.get('cookie') || headers.get('authorization'));
}

/**
 * Get the full Better Auth session (user + session metadata).
 * Returns null if not authenticated.
 */
export async function getSession() {
  try {
    const { headers } = await import('next/headers');
    const requestHeaders = await headers();
    if (!hasAuthCredential(requestHeaders)) return null;

    const auth = getAuth();
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

/**
 * Get current user from raw request headers (for API routes/middleware).
 * Does NOT use next/headers — pass headers explicitly.
 *
 * Throws AuthSystemError on DB/system failures so callers can distinguish
 * "no session" (return null → 401) from "system down" (503 + retry hint).
 */
export async function getCurrentUserFromHeaders(
  reqHeaders: Headers,
): Promise<User | null> {
  try {
    if (!hasAuthCredential(reqHeaders)) return null;

    const auth = getAuth();
    if (!auth) return null;
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session) return null;

    const user = session.user as Record<string, unknown>;
    return {
      id: session.user.id,
      email: session.user.email,
      full_name: (session.user.name ?? undefined) as string | undefined,
      avatar_url: (session.user.image ?? undefined) as string | undefined,
      role: (user.role as string) ?? 'user',
    };
  } catch (err) {
    unstable_rethrow(err);
    logger.error(
      '[better-auth-session] getCurrentUserFromHeaders failed',
      err instanceof Error ? err : new Error(String(err)),
      {
        errorName: err instanceof Error ? err.constructor.name : typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    );
    // Surface system/DB errors so callers can distinguish from "no session"
    throw new AuthSystemError(
      err instanceof Error ? err.message : String(err),
      err,
    );
  }
}
