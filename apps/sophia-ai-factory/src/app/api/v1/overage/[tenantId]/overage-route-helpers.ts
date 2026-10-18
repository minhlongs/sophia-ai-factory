/**
 * Auth validation and database helpers for the tenant overage endpoint.
 * @module app/api/v1/overage/[tenantId]/overage-route-helpers
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { validateJwt } from '@/seed/security/jwt-validator';
import { requireOrgMembership } from '@/seed/db/org-membership';
import { checkRateLimit as checkApiRateLimit } from '@/seed/security/rate-limiter';

export { fetchTenantOverageData, type TenantOverageData } from './overage-data-loader';

export interface TenantAuthSuccess {
  authorized: true;
  userId: string;
  rateLimitResult: {
    remaining: number;
    resetAt: number;
  };
}

export interface TenantAuthFailure {
  authorized: false;
  response: NextResponse;
}

export async function verifyTenantOverageAccess(
  r: NextRequest,
  tenantId: string,
): Promise<TenantAuthSuccess | TenantAuthFailure> {
  const authHeader = r.headers.get('authorization');
  const jwtResult = await validateJwt(authHeader);

  if (!jwtResult.valid) {
    logger.warn('[Overage API] JWT validation failed', { error: jwtResult.error, tenantId });
    return {
      authorized: false,
      response: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }),
    };
  }

  const userId = jwtResult.payload?.sub;
  if (!userId) {
    return {
      authorized: false,
      response: NextResponse.json({ message: 'Invalid JWT payload' }, { status: 401 }),
    };
  }

  const jwtAgencyId =
    jwtResult.payload && 'agency_id' in jwtResult.payload
      ? jwtResult.payload.agency_id
      : undefined;
  if (!jwtAgencyId || jwtAgencyId !== tenantId) {
    logger.warn('[Overage API] JWT tenant claim does not match requested tenant', {
      userId,
      requestedTenant: tenantId,
      jwtAgencyId,
    });
    return {
      authorized: false,
      response: NextResponse.json({ message: 'Cross-tenant access denied' }, { status: 403 }),
    };
  }

  const membershipResult = await requireOrgMembership(userId);
  if (!membershipResult.authorized) {
    logger.warn('[Overage API] User not in any org', { userId, tenantId });
    return {
      authorized: false,
      response: NextResponse.json({ message: 'Forbidden' }, { status: 403 }),
    };
  }

  if (membershipResult.orgId !== tenantId) {
    logger.warn('[Overage API] Organization membership does not match requested tenant', {
      userId,
      requestedTenant: tenantId,
      memberOrgId: membershipResult.orgId,
    });
    return {
      authorized: false,
      response: NextResponse.json({ message: 'Cross-tenant access denied' }, { status: 403 }),
    };
  }

  const agencyIdHeader = r.headers.get('x-raas-agency-id');
  if (agencyIdHeader && agencyIdHeader !== tenantId) {
    logger.warn('[Overage API] Cross-tenant access attempt blocked', {
      userId,
      requestedTenant: tenantId,
      agencyIdHeader,
    });
    return {
      authorized: false,
      response: NextResponse.json({ message: 'Cross-tenant access denied' }, { status: 403 }),
    };
  }

  const rateLimitResult = await checkApiRateLimit(tenantId, 100);
  if (!rateLimitResult.allowed) {
    return {
      authorized: false,
      response: NextResponse.json(
        { message: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toISOString(),
          },
        },
      ),
    };
  }

  return {
    authorized: true,
    userId,
    rateLimitResult: {
      remaining: rateLimitResult.remaining,
      resetAt: rateLimitResult.resetAt,
    },
  };
}
