import { NextResponse } from 'next/server';
import { getCurrentUserFromHeaders, AuthSystemError } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Options for auth guard behavior
 */
export interface AuthGuardOptions {
  /**
   * Path to redirect unauthenticated users (for page routes).
   * If not provided, returns 401 JSON response (default for API routes).
   */
  redirectTo?: string;

  /**
   * Custom 401 message
   */
  unauthorizedMessage?: string;

  /**
   * Skip CSRF check for this route (some public routes like webhooks don't need it)
   */
  skipCsrf?: boolean;
}

/**
 * Standard 401 JSON response for API routes
 */
export const DEFAULT_UNAUTHORIZED_RESPONSE = (message?: string): NextResponse =>
  NextResponse.json(
    { error: 'Unauthorized', detail: message || 'Authentication required' },
    { status: 401 }
  );

/**
 * Auth-specific error class for programmatic handling
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number = 401,
    public readonly detail?: string
  ) {
    super(message);
    this.name = 'AuthError';
  }

  toResponse(): NextResponse {
    return NextResponse.json(
      { error: this.message, detail: this.detail },
      { status: this.status }
    );
  }
}

/**
 * Core auth check using Better Auth session.
 * Returns user info if authenticated, null if not.
 * Throws AuthSystemError on system failures (DB/network issues).
 */
export async function checkAuth(
  reqHeaders: Headers
): Promise<{ authenticated: true; user: Awaited<ReturnType<typeof getCurrentUserFromHeaders>> } | { authenticated: false }> {
  try {
    const user = await getCurrentUserFromHeaders(reqHeaders);
    if (!user) {
      return { authenticated: false };
    }
    return { authenticated: true, user };
  } catch (err) {
    if (err instanceof AuthSystemError) {
      logger.error('[AuthGuard] System error during auth check', err);
      throw err;
    }
    logger.debug('[AuthGuard] Auth check failed', { error: err });
    return { authenticated: false };
  }
}
