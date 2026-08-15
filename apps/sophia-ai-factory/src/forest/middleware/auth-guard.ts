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
  // Pinned exact paths only. Broad prefixes were removed (2026-08-15 security audit)
  // because any new subpath under /api/auth, /api/webhooks, /api/cron, etc. became
  // public automatically. New public endpoints must be added explicitly here.
  const exactPublic = new Set([
    // Health / status (public)
    '/api/health',
    '/api/sophia-index/health',
    '/api/public',
    '/api/version',
    '/api/version-badge',
    '/api/version-text',
    '/api/robots.txt',
    '/api/sitemap.xml',
    '/api/status.json',
    '/api/csp-report',
    '/api/check-access',
    '/api/openapi.json',

    // Explicit Better Auth routes (must stay public — Better Auth handles its own auth)
    '/api/auth/sign-in/email',
    '/api/auth/sign-up/email',
    '/api/auth/sign-in/password-reset/request',
    '/api/auth/sign-in/password-reset/confirm',
    '/api/auth/magic-link',
    '/api/auth/callback',
    '/api/auth/session',
    '/api/auth/logout',
    '/api/auth/mfa/setup',
    '/api/auth/mfa/verify',
    '/api/auth/mfa/challenge',
    '/api/auth/mfa/status',
    '/api/auth/mfa/disable',
    '/api/auth/admin-challenge',
    '/api/auth/youtube/callback',
    '/api/auth/youtube/disconnect',
    '/api/auth/tiktok/callback',

    // Explicit webhook routes (authenticated via signature, not session)
    '/api/webhooks/nowpayments',
    '/api/webhooks/clickbank',
    '/api/webhooks/shopify',
    '/api/webhooks/stripe',
    '/api/webhooks/payos',

    // Internal scheduler (authenticated via INTERNAL_CRON_SECRET, not session)
    '/api/cron/email-drip',
    '/api/cron/d1-backup',
    '/api/cron/usage-aggregation',
    '/api/cron/affiliate-payout',
    '/api/cron/payment-reconciliation',

    // Inngest SSE webhook
    '/api/inngest',

    // Checkout / order flows (token-based, not session)
    '/api/checkout/status',
    '/api/pricing/stripe-checkout',

    // Token-based email flows
    '/api/welcome/resend',
    '/api/welcome/validate',
    '/api/account/delete/confirm',
    '/api/account/change-email/verify',
    '/api/sign-in/email-verification',
  ]);

  if (exactPublic.has(pathname)) return true;

  // Stable token-based flow prefix family
  if (pathname.startsWith('/api/sign-')) return true;
  if (pathname.startsWith('/api/auth/')) return false; // default deny
  if (pathname.startsWith('/api/webhooks/')) return false; // default deny
  if (pathname.startsWith('/api/cron/')) return false; // default deny

  return false;
}

