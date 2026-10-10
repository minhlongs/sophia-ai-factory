/**
 * Admin Role & Guard Middleware Helpers
 * Layer: seed
 *
 * @module seed/auth/admin/admin-guard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { User } from '@/seed/db/client';
import { requireRecentAuth } from './challenge-token';
import { getOperatorId, hasDeployToken } from './operator-identity';
import type { RequireAdminResult } from './types';

/**
 * Gate a route on Better Auth session + current DB admin role.
 * Returns { user } on success, or a NextResponse with 401/403/503 on failure.
 */
export async function requireAdmin(
  request: NextRequest | Request,
): Promise<RequireAdminResult> {
  const headers =
    request instanceof Request
      ? request.headers
      : (request as NextRequest).headers;

  let user: User | null;
  try {
    user = await getCurrentUserFromHeaders(headers);
  } catch (err) {
    logger.error('[requireAdmin] Auth lookup failed', toError(err));
    return NextResponse.json(
      { error: 'Authentication service temporarily unavailable' },
      { status: 503 },
    );
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = await isUserAdmin(user);
    if (!admin) {
      return NextResponse.json(
        { error: 'Forbidden: admin role required' },
        { status: 403 },
      );
    }
    return { user };
  } catch (err) {
    logger.error('[requireAdmin] Admin check failed', toError(err));
    return NextResponse.json(
      { error: 'Authentication service temporarily unavailable' },
      { status: 503 },
    );
  }
}

/**
 * Require admin (via session) OR valid deploy token.
 * Returns { userId: string, isDeployToken: boolean } on success,
 * or NextResponse on failure.
 */
export async function requireAdminOrDeploy(
  request: NextRequest | Request,
): Promise<{ userId: string; isDeployToken: boolean } | NextResponse> {
  const adminResult = await requireAdmin(request);
  if (!(adminResult instanceof NextResponse)) {
    return { userId: adminResult.user.id, isDeployToken: false };
  }

  if (hasDeployToken(request)) {
    const operatorId = getOperatorId(request);
    if (operatorId) {
      return { userId: operatorId, isDeployToken: true };
    }
  }

  return adminResult;
}

/**
 * Combined gate: require admin role AND recent authentication challenge.
 * This is the ASVS V3.5.1 enforcement helper for destructive admin mutations.
 */
export async function requireAdminWithRecentAuth(
  request: NextRequest | Request,
): Promise<(RequireAdminResult & { recentAuth: true }) | NextResponse> {
  const adminResult = await requireAdmin(request);
  if (adminResult instanceof NextResponse) {
    return adminResult;
  }

  const recentAuth = await requireRecentAuth(request);
  if (!recentAuth.ok) {
    const status = recentAuth.reason === 'no-challenge' ? 401 : 403;
    return NextResponse.json(
      {
        error: 'Re-authentication required',
        reason: recentAuth.reason,
        detail:
          recentAuth.reason === 'no-challenge'
            ? 'Please confirm your password to continue.'
            : 'Authentication session expired. Please try again.',
      },
      { status },
    );
  }

  return { ...adminResult, recentAuth: true };
}
