import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/seed/auth/better-auth-server';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

/**
 * Authentication middleware utilities
 *
 * Handles session verification and redirect logic for protected routes.
 */

/**
 * Internal session shape from Better Auth
 */
export interface BetterAuthSession {
  user: {
    id: string;
    email?: string;
    name?: string;
    image?: string;
    role?: string;
  };
  session: {
    id: string;
    expiresAt?: number;
    // ... other fields not needed for middleware
  };
}

/**
 * Check if the request has a valid authenticated session.
 * Returns the session if authenticated, undefined otherwise.
 */
export async function getSessionFromRequest(
  request: NextRequest
): Promise<{ authenticated: boolean; session?: BetterAuthSession }> {
  try {
    const auth = await getAuth();
    if (!auth) {
      logger.warn('[Middleware Auth] Auth instance not available');
      return { authenticated: false };
    }

    const result = await auth.api.getSession({ headers: request.headers });

    if (!result?.session) {
      return { authenticated: false };
    }

    // Normalize expiresAt to number (timestamp) if it's a Date
    const rawSession = result.session;
    const expiresAt = rawSession.expiresAt instanceof Date
      ? rawSession.expiresAt.getTime()
      : (rawSession.expiresAt as number | undefined);

    return {
      authenticated: true,
      session: {
        ...result,
        session: {
          ...rawSession,
          expiresAt,
        },
      } as BetterAuthSession,
    };
  } catch (error) {
    logger.error('[Middleware Auth] Session check failed:', toError(error));
    return { authenticated: false };
  }
}

/**
 * Ensure the user is authenticated.
 * If not, returns a redirect response to login page.
 * If yes, returns the session object.
 */
export async function requireAuth(
  request: NextRequest,
  locale: string
): Promise<{ session: BetterAuthSession } | NextResponse> {
  const result = await getSessionFromRequest(request);

  if (!result.authenticated || !result.session) {
    const url = new URL(`/${locale}/login`, request.url);
    return NextResponse.redirect(url);
  }

  return { session: result.session };
}

/**
 * Check if the path requires authentication (protected route).
 */
export function isProtectedPath(pathname: string): boolean {
  // Dashboard routes require auth
  return pathname.startsWith('/dashboard') ||
         pathname.startsWith('/api/account') ||
         pathname.startsWith('/api/admin') ||
         pathname.startsWith('/api/billing');
}
