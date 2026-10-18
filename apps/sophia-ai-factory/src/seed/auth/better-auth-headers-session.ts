/**
 * Request-Headers Session Lookup Helpers
 *
 * Resolves Better Auth sessions directly from passed `Headers` (for API routes
 * and middleware) without invoking `next/headers`.
 *
 * @module seed/auth/better-auth-headers-session
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

export function hasAuthCredential(headers: Headers): boolean {
  return Boolean(headers.get('cookie') || headers.get('authorization'));
}

export interface RawSessionData {
  user: User;
  session: {
    id: string;
    expiresAt?: number;
    [key: string]: unknown;
  };
}

/**
 * Get raw session and user data from request headers for middleware.
 */
export async function getSessionFromHeaders(
  reqHeaders: Headers,
): Promise<RawSessionData | null> {
  try {
    if (!hasAuthCredential(reqHeaders)) return null;

    const auth = await getAuth();
    if (!auth) return null;
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session || !session.user) return null;

    const user = session.user as Record<string, unknown>;
    const rawSession = (session.session ?? {}) as Record<string, unknown>;
    const expiresAt = rawSession.expiresAt instanceof Date
      ? rawSession.expiresAt.getTime()
      : (rawSession.expiresAt as number | undefined);

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        full_name: (session.user.name ?? undefined) as string | undefined,
        avatar_url: (session.user.image ?? undefined) as string | undefined,
        role: (user.role as string) ?? 'user',
      },
      session: {
        ...rawSession,
        id: (rawSession.id as string) ?? session.user.id,
        expiresAt,
      },
    };
  } catch (err) {
    unstable_rethrow(err);
    logger.error(
      '[better-auth-session] getSessionFromHeaders failed',
      err instanceof Error ? err : new Error(String(err)),
      {
        errorName: err instanceof Error ? err.constructor.name : typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    );
    throw new AuthSystemError(
      err instanceof Error ? err.message : String(err),
      err,
    );
  }
}

/**
 * Get current user from raw request headers (for API routes/middleware).
 * Does NOT use next/headers — pass headers explicitly.
 */
export async function getCurrentUserFromHeaders(
  reqHeaders: Headers,
): Promise<User | null> {
  const result = await getSessionFromHeaders(reqHeaders);
  return result ? result.user : null;
}
