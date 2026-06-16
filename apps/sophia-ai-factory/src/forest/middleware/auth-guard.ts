/**
 * Auth Guard Middleware for API Routes
 *
 * Protects API routes by validating user authentication via Better Auth.
 * Returns 401 JSON response for unauthenticated requests.
 *
 * Usage in middleware.ts:
 *   import { withAuth } from '@/forest/middleware/auth-guard';
 *   if (pathname.startsWith('/api')) {
 *     const authResponse = await withAuth(request);
 *     if (authResponse) return authResponse;
 *   }
 *
 * Or directly in route handlers:
 *   import { requireAuthJson } from '@/forest/middleware/auth-guard';
 *   export async function GET(request: Request) {
 *     const auth = await requireAuthJson(request);
 *     if (auth instanceof Response) return auth;
 *     // ... authenticated logic
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders, AuthSystemError } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

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
const DEFAULT_UNAUTHORIZED_RESPONSE = (message?: string) =>
  NextResponse.json(
    { error: 'Unauthorized', detail: message || 'Authentication required' },
    { status: 401 }
  );

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
    // Distinguish system errors from "not logged in"
    if (err instanceof AuthSystemError) {
      logger.error('[AuthGuard] System error during auth check', err);
      throw err; // Caller should handle as 503 (retryable)
    }
    // Other errors treat as unauthenticated
    logger.debug('[AuthGuard] Auth check failed', { error: err });
    return { authenticated: false };
  }
}

/**
 * Middleware-style guard that returns a blocking response if auth fails.
 * Returns NextResponse if should block (401/redirect), null if authenticated.
 *
 * @param request - NextRequest to check
 * @param options - Configuration options
 * @returns NextResponse to block, or null to continue
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
 *
 * @param request - NextRequest to check
 * @param options - Configuration options
 * @returns User object or NextResponse error
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
 *
 * @throws {AuthError} with status 401 if not authenticated
 * @throws {AuthSystemError} with status 503 if system failure
 */
export async function requireAuthOrThrow(request: NextRequest): Promise<{ user: Awaited<ReturnType<typeof getCurrentUserFromHeaders>> }> {
  const result = await checkAuth(request.headers);

  if (!result.authenticated) {
    throw new AuthError('Unauthorized', 401);
  }

  return { user: result.user };
}

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
 * Check if a pathname matches any of the excluded public route patterns.
 * These routes do NOT require authentication even under blanket auth guard.
 */
export function isPublicApiRoute(pathname: string): boolean {
  // Exact/prefix matches for public endpoints
  const publicPatterns = [
    // Health checks (public)
    '/api/health',
    '/api/sophia-index/health',

    // Version endpoint (public)
    '/api/version',

    // Webhooks (external service callbacks - authenticated via signature, not session)
    '/api/webhooks',

    // Auth endpoints (login, logout, callback, session, signup, MFA setup, reset)
    '/api/auth',
    '/api/oauth',

    // Public API documentation
    '/api/openapi',
    '/api/status.json',

    // CSP reports (browser sent, no auth)
    '/api/csp-report',

    // Public check endpoint (tier/feature check without login)
    '/api/check-access',

    // Cron endpoints (internal scheduler - uses INTERNAL_CRON_SECRET)
    '/api/cron',

    // Inngest webhook (external job scheduler)
    '/api/inngest',

    // Checkout status (uses orderId as bearer token, not session)
    '/api/checkout/status',

    // Token-based email flows (magic link, email verification, password reset)
    '/api/welcome/resend',
    '/api/welcome/validate',
    '/api/account/delete/confirm',
    '/api/account/change-email/verify',
  ];

  for (const pattern of publicPatterns) {
    // Exact match
    if (pathname === pattern) return true;
    // Prefix match: if pattern is a directory (or prefix), any subpath is also public
    if (pathname.startsWith(pattern + '/')) return true;
    // Wildcard suffix match (e.g., '/api/sign-*')
    if (pattern.endsWith('*') && pathname.startsWith(pattern.slice(0, -1))) return true;
  }

  // /api/sign-* pattern (email verification, password reset tokens)
  if (pathname.startsWith('/api/sign-')) return true;

  return false;
}

