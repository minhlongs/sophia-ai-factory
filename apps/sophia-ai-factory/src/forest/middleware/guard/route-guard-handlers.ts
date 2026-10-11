import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders, AuthSystemError } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  AuthGuardOptions,
  DEFAULT_UNAUTHORIZED_RESPONSE,
  AuthError,
  checkAuth,
} from './auth-check';

/**
 * Middleware-style guard that returns a blocking response if auth fails.
 * Returns NextResponse if should block (401/redirect), null if authenticated.
 */
export async function withAuth(
  request: NextRequest,
  options: AuthGuardOptions = {}
): Promise<NextResponse | null> {
  const { redirectTo, unauthorizedMessage } = options;

  try {
    const result = await checkAuth(request.headers);

    if (!result.authenticated) {
      if (redirectTo) {
        const url = new URL(redirectTo, request.url);
        return NextResponse.redirect(url);
      }
      return DEFAULT_UNAUTHORIZED_RESPONSE(unauthorizedMessage);
    }

    return null; // Authenticated, continue
  } catch (err) {
    // System error — return 503 with retry hint
    logger.error('[AuthGuard] System failure', toError(err));
    return NextResponse.json(
      {
        error: 'Service unavailable',
        detail: 'Authentication service temporarily unavailable. Please retry.',
        retryAfter: 30,
      },
      { status: 503 }
    );
  }
}

/**
 * Route handler helper for API routes.
 * Returns either a Response (unauthorized error) or the authenticated user.
 */
export async function requireAuthJson(
  request: NextRequest,
  options: AuthGuardOptions = {}
): Promise<Awaited<ReturnType<typeof getCurrentUserFromHeaders>> | NextResponse> {
  try {
    const result = await checkAuth(request.headers);

    if (!result.authenticated) {
      return DEFAULT_UNAUTHORIZED_RESPONSE(options.unauthorizedMessage);
    }

    return result.user;
  } catch (err) {
    if (err instanceof AuthSystemError) {
      return NextResponse.json(
        {
          error: 'Service unavailable',
          detail: 'Authentication service temporarily unavailable.',
        },
        { status: 503 }
      );
    }
    return DEFAULT_UNAUTHORIZED_RESPONSE();
  }
}

/**
 * Route handler helper that throws on auth failure.
 * Use this when you want to handle errors via try/catch in your route.
 */
export async function requireAuthOrThrow(
  request: NextRequest
): Promise<{ user: Awaited<ReturnType<typeof getCurrentUserFromHeaders>> }> {
  const result = await checkAuth(request.headers);

  if (!result.authenticated) {
    throw new AuthError('Unauthorized', 401);
  }

  return { user: result.user };
}
