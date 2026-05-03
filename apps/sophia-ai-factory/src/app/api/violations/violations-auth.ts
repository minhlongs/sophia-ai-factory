/**
 * Violations API Authentication & RBAC Helpers
 *
 * Handles JWT/API-key auth, rate limiting, and RBAC for the violations route.
 *
 * @module app/api/violations/violations-auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { verifyLicenseAccess, getUserLicenseNonce, checkAdmin } from '@/lib/analytics/rbac';
import { validateApiKey } from '@/seed/security/api-key-validator';
import { validateJwt } from '@/seed/security/jwt-validator';
import { checkRateLimit } from '@/seed/security/rate-limiter';

export interface AuthResult {
  userId: string;
  userTier: string | null;
  isAdmin: boolean;
  apiKeyId: string | null;
}

/** Authenticate request via JWT or API key; returns null + 401/429 response on failure */
export async function authenticateRequest(
  request: NextRequest,
): Promise<{ auth: AuthResult; error?: never } | { auth?: never; error: NextResponse }> {
  let userId: string | null = null;
  let userTier: string | null = null;
  let isAdmin = false;
  let apiKeyId: string | null = null;

  const authHeader = request.headers.get('authorization');
  const jwtResult = await validateJwt(authHeader);

  if (jwtResult.valid && jwtResult.payload) {
    userId = jwtResult.payload.sub;
    const user = await getCurrentUser();
    if (user) {
      userTier = await getUserTier(user.id);
      isAdmin = await checkAdmin(user.id);

      const rateLimitResult = await checkRateLimit(user.id, 100);
      if (!rateLimitResult.allowed) {
        return {
          error: NextResponse.json(
            { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
            { status: 429 }
          ),
        };
      }
    }
  } else {
    const apiKey = request.headers.get('x-api-key');
    const apiKeyResult = await validateApiKey(apiKey);

    if (apiKeyResult.valid && apiKeyResult.apiKey) {
      userId = apiKeyResult.apiKey.ownerId;
      userTier = 'PREMIUM';
      apiKeyId = apiKeyResult.apiKey.keyId;

      const rateLimitResult = await checkRateLimit(apiKeyId, apiKeyResult.apiKey.rateLimitPerMinute);
      if (!rateLimitResult.allowed) {
        return {
          error: NextResponse.json(
            { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
            { status: 429 }
          ),
        };
      }
    }
  }

  if (!userId) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized - authentication required (JWT Bearer token or X-API-Key)' },
        { status: 401 }
      ),
    };
  }

  return { auth: { userId, userTier, isAdmin, apiKeyId } };
}

export interface RbacResult {
  queryLicenseNonce: string | undefined;
  error?: NextResponse;
}

/** Apply RBAC rules to determine queryable license nonce */
export async function applyRbac(
  userId: string,
  isAdmin: boolean,
  licenseNonce: string | undefined,
  filterUserId: string | undefined,
): Promise<RbacResult> {
  let queryLicenseNonce: string | undefined = licenseNonce;

  if (!isAdmin) {
    if (filterUserId && filterUserId !== userId) {
      return {
        queryLicenseNonce: undefined,
        error: NextResponse.json({ error: 'Access denied - can only query own violations' }, { status: 403 }),
      };
    }

    if (licenseNonce) {
      const access = await verifyLicenseAccess(userId, licenseNonce, false);
      if (!access.allowed) {
        return {
          queryLicenseNonce: undefined,
          error: NextResponse.json({ error: access.error || 'Access denied' }, { status: 403 }),
        };
      }
    } else {
      queryLicenseNonce = (await getUserLicenseNonce(userId)) || undefined;
    }
  }

  return { queryLicenseNonce };
}
