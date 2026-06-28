import { NextRequest, NextResponse } from 'next/server';
import { isSessionMfaPending } from '@/seed/auth/mfa/login-challenge';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

/**
 * MFA gate middleware utilities
 *
 * Enforces MFA verification for sensitive routes and operations.
 * MFA challenge paths are always allowed to prevent lockout.
 */

/**
 * Paths that are always accessible regardless of MFA status.
 * These routes allow users to complete MFA verification.
 */
const MFA_ALLOWLIST_PATHS = [
  '/auth/mfa-challenge',
  '/api/auth/mfa/challenge',
  '/api/auth/mfa/verify',
];

/**
 * Check if the given path is exempt from MFA requirements.
 * Allowlisted paths let users complete the MFA flow.
 */
export function isMfaChallengePath(pathname: string): boolean {
  return MFA_ALLOWLIST_PATHS.some(
    pattern => pathname === pattern || pathname.startsWith(pattern + '/')
  );
}

/**
 * Check if MFA is required for the given path.
 * Public pages and allowlisted paths don't require MFA.
 */
export function requiresMfaCheck(pathname: string): boolean {
  if (isMfaChallengePath(pathname)) {
    return false;
  }

  // Dashboard and user-facing sensitive pages
  if (pathname.startsWith('/dashboard') ||
      pathname.startsWith('/auth/setup-wizard') ||
      pathname.startsWith('/onboarding')) {
    return true;
  }

  // API: Account, billing, payments, subscriptions, checkout
  if (pathname.startsWith('/api/account') ||
      pathname.startsWith('/api/billing') ||
      pathname.startsWith('/api/payments') ||
      pathname.startsWith('/api/subscriptions') ||
      pathname.startsWith('/api/checkout') ||
      pathname.startsWith('/api/affiliates/payout-method') ||
      pathname.startsWith('/api/v1/settings')) {
    return true;
  }

  // Admin routes (all subpaths)
  if (pathname.startsWith('/api/admin')) {
    return true;
  }

  return false;
}

/**
 * Verify that the user's session has completed MFA.
 * If MFA is pending, returns a 403 response for API routes
 * or a redirect to MFA challenge page for page routes.
 */
export async function enforceMfaGate(
  sessionId: string,
  pathname: string,
  request: NextRequest
): Promise<NextResponse | null> {
  // Skip MFA check for allowlisted paths
  if (isMfaChallengePath(pathname)) {
    return null;
  }

  // Only enforce if MFA is required for this path
  if (!requiresMfaCheck(pathname)) {
    return null;
  }

  try {
    const pending = await isSessionMfaPending(sessionId);
    if (!pending) {
      return null; // MFA completed, allow access
    }

    // MFA pending - handle based on route type
    if (pathname.startsWith('/api/')) {
      // API routes return 403 JSON
      return NextResponse.json(
        { error: 'MFA verification required' },
        { status: 403 }
      );
    } else {
      // Page routes redirect to MFA challenge
      const url = new URL('/auth/mfa-challenge', request.url);
      return NextResponse.redirect(url);
    }
  } catch (mfaErr) {
    // Fail closed on errors - deny access rather than bypass
    logger.error('[Middleware] MFA pending check error', toError(mfaErr));

    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication service temporarily unavailable. Please try again.' },
        { status: 503 }
      );
    } else {
      return NextResponse.redirect(
        new URL('/login?error=auth_service_unavailable', request.url)
      );
    }
  }
}
